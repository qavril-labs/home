#!/usr/bin/env python3
"""
Generates typed OpenAPI TypeScript definitions and API client for frontend/web/src/lib/api/
from contracts/openapi.yaml.
"""
import os
import sys
import yaml
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
CONTRACT_PATH = REPO_ROOT / "contracts" / "openapi.yaml"
OUTPUT_DIR = REPO_ROOT / "frontend" / "web" / "src" / "lib" / "api"

def schema_to_ts(schema, indent=0):
    if not schema:
        return "unknown"
    
    # Handle $ref
    if "$ref" in schema:
        ref = schema["$ref"]
        if ref.startswith("#/components/schemas/"):
            return ref.replace("#/components/schemas/", "")
        return "unknown"

    # Handle oneOf / anyOf / allOf
    if "oneOf" in schema:
        return " | ".join(f"({schema_to_ts(s, indent)})" for s in schema["oneOf"])
    if "anyOf" in schema:
        return " | ".join(f"({schema_to_ts(s, indent)})" for s in schema["anyOf"])
    if "allOf" in schema:
        return " & ".join(f"({schema_to_ts(s, indent)})" for s in schema["allOf"])

    # Handle const
    if "const" in schema:
        val = schema["const"]
        if isinstance(val, bool):
            return "true" if val else "false"
        elif isinstance(val, str):
            return f'"{val}"'
        return str(val)

    # Handle enum
    if "enum" in schema:
        vals = []
        for val in schema["enum"]:
            if isinstance(val, bool):
                vals.append("true" if val else "false")
            elif isinstance(val, str):
                vals.append(f'"{val}"')
            else:
                vals.append(str(val))
        return " | ".join(vals)

    stype = schema.get("type")
    if isinstance(stype, list):
        types = [schema_to_ts({"type": t}, indent) for t in stype]
        return " | ".join(types)

    if stype == "string":
        return "string"
    elif stype in ("integer", "number"):
        return "number"
    elif stype == "boolean":
        return "boolean"
    elif stype == "null":
        return "null"
    elif stype == "array":
        items = schema.get("items", {})
        item_ts = schema_to_ts(items, indent)
        if " | " in item_ts or " & " in item_ts:
            return f"({item_ts})[]"
        return f"{item_ts}[]"
    elif stype == "object" or "properties" in schema:
        props = schema.get("properties", {})
        required = set(schema.get("required", []))
        if not props and schema.get("additionalProperties") is True:
            return "Record<string, unknown>"
        if not props and not schema.get("additionalProperties"):
            return "Record<string, unknown>"
        
        lines = ["{"]
        pad = "  " * (indent + 1)
        for prop_name, prop_schema in props.items():
            is_req = prop_name in required
            opt = "" if is_req else "?"
            prop_ts = schema_to_ts(prop_schema, indent + 1)
            # escape property name if needed
            safe_name = f'"{prop_name}"' if ("-" in prop_name or " " in prop_name or "." in prop_name) else prop_name
            lines.append(f"{pad}{safe_name}{opt}: {prop_ts};")
        
        if schema.get("additionalProperties") and schema["additionalProperties"] is not True:
            add_ts = schema_to_ts(schema["additionalProperties"], indent + 1)
            lines.append(f"{pad}[key: string]: {add_ts};")
        
        lines.append(("  " * indent) + "}")
        return "\n".join(lines)

    return "unknown"

def main():
    if not CONTRACT_PATH.exists():
        print(f"Error: Contract not found at {CONTRACT_PATH}", file=sys.stderr)
        sys.exit(1)

    with open(CONTRACT_PATH, "r", encoding="utf-8") as f:
        spec = yaml.safe_load(f)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # 1. Generate schema.ts
    schemas = spec.get("components", {}).get("schemas", {})
    schema_code = [
        "/**",
        " * Generated from contracts/openapi.yaml.",
        " * DO NOT EDIT DIRECTLY. Run `npm --prefix frontend run api:generate`.",
        " */",
        "",
    ]

    for name, s in schemas.items():
        desc = s.get("description", "")
        if desc:
            schema_code.append(f"/** {desc.strip()} */")
        ts_type = schema_to_ts(s, 0)
        schema_code.append(f"export type {name} = {ts_type};")
        schema_code.append("")

    # Also build operation paths
    schema_code.append("// -------------------------------------------------------------")
    schema_code.append("// Operations Map")
    schema_code.append("// -------------------------------------------------------------")
    schema_code.append("export interface Operations {")
    
    paths = spec.get("paths", {})
    op_list = []
    for path_str, methods in paths.items():
        for method, op in methods.items():
            if method.lower() not in ("get", "post", "put", "patch", "delete", "options", "head"):
                continue
            op_id = op.get("operationId") or f"{method.lower()}_{path_str.replace('/', '_')}"
            op_list.append((op_id, method.upper(), path_str, op))
            schema_code.append(f'  "{op_id}": {{')
            schema_code.append(f'    method: "{method.upper()}";')
            schema_code.append(f'    path: "{path_str}";')
            
            # request body
            rb = op.get("requestBody", {})
            rb_content = rb.get("content", {}).get("application/json", {}).get("schema")
            if rb_content:
                schema_code.append(f'    requestBody: {schema_to_ts(rb_content, 2)};')
            else:
                schema_code.append("    requestBody?: unknown;")

            # response 200/201
            resp_schema = None
            for status in ("200", "201", "204"):
                if status in op.get("responses", {}):
                    resp_schema = op["responses"][status].get("content", {}).get("application/json", {}).get("schema")
                    break
            if resp_schema:
                schema_code.append(f'    response: {schema_to_ts(resp_schema, 2)};')
            else:
                schema_code.append("    response?: unknown;")

            schema_code.append("  };")

    schema_code.append("}")
    schema_code.append("")

    schema_file = OUTPUT_DIR / "schema.ts"
    with open(schema_file, "w", encoding="utf-8") as f:
        f.write("\n".join(schema_code))
    print(f"Generated {schema_file} ({len(schemas)} schemas, {len(op_list)} operations)")

    # 2. Generate client.ts
    client_code = [
        "/**",
        " * Generated contract-compliant HTTP client from contracts/openapi.yaml.",
        " * Provides strong typing for API queries, mutations and error payloads.",
        " */",
        'import type { Operations } from "./schema";',
        "",
        "export interface ApiClientOptions {",
        "  baseUrl?: string;",
        "  getToken?: () => string | null;",
        "  onUnauthorized?: () => void;",
        "}",
        "",
        "export interface ApiResult<T> {",
        "  data: T;",
        "  isLive: boolean;",
        "  status: number;",
        "  endpoint: string;",
        "}",
        "",
        "export class ContractApiClient {",
        "  private baseUrl: string;",
        "  private getToken: () => string | null;",
        "  private onUnauthorized?: () => void;",
        "",
        "  constructor(options: ApiClientOptions = {}) {",
        '    this.baseUrl = options.baseUrl || "";',
        "    this.getToken = options.getToken || (() => null);",
        "    this.onUnauthorized = options.onUnauthorized;",
        "  }",
        "",
        "  public async request<K extends keyof Operations>(",
        "    operationId: K,",
        "    params?: {",
        "      pathParams?: Record<string, string | number>;",
        "      queryParams?: Record<string, string | number | boolean | undefined>;",
        "      body?: Operations[K] extends { requestBody: infer B } ? B : never;",
        "      idempotencyKey?: string;",
        "    }",
        "  ): Promise<ApiResult<Operations[K] extends { response: infer R } ? R : unknown>> {",
        "    const headers: Record<string, string> = {",
        '      "Content-Type": "application/json",',
        '      Accept: "application/json",',
        "    };",
        "",
        "    const token = this.getToken();",
        "    if (token) {",
        '      headers["Authorization"] = `Bearer ${token}`;',
        "    }",
        "    if (params?.idempotencyKey) {",
        '      headers["Idempotency-Key"] = params.idempotencyKey;',
        "    }",
        "",
        "    // Route lookup table",
        "    const routeMeta = this.getOperationRoute(operationId);",
        "    let resolvedPath = routeMeta.path;",
        "    if (params?.pathParams) {",
        "      for (const [key, val] of Object.entries(params.pathParams)) {",
        '        resolvedPath = resolvedPath.replace(`{${key}}`, encodeURIComponent(String(val)));',
        "      }",
        "    }",
        "",
        "    if (params?.queryParams) {",
        "      const searchParams = new URLSearchParams();",
        "      for (const [key, val] of Object.entries(params.queryParams)) {",
        "        if (val !== undefined) {",
        "          searchParams.append(key, String(val));",
        "        }",
        "      }",
        "      const qs = searchParams.toString();",
        '      if (qs) resolvedPath += `?${qs}`;',
        "    }",
        "",
        "    const url = `${this.baseUrl}${resolvedPath}`;",
        "    try {",
        "      const res = await fetch(url, {",
        "        method: routeMeta.method,",
        "        headers,",
        "        body: params?.body ? JSON.stringify(params.body) : undefined,",
        "      });",
        "",
        "      if (res.status === 401 && this.onUnauthorized) {",
        "        this.onUnauthorized();",
        "      }",
        "",
        "      const data = await res.json().catch(() => ({}));",
        "      return {",
        "        data: data as any,",
        "        isLive: true,",
        "        status: res.status,",
        "        endpoint: resolvedPath,",
        "      };",
        "    } catch (err) {",
        "      return {",
        "        data: {} as any,",
        "        isLive: false,",
        "        status: 0,",
        "        endpoint: resolvedPath,",
        "      };",
        "    }",
        "  }",
        "",
        "  private getOperationRoute(opId: keyof Operations): { method: string; path: string } {",
        "    const routes: Record<keyof Operations, { method: string; path: string }> = {",
    ]

    for op_id, method, path_str, _ in op_list:
        client_code.append(f'      "{op_id}": {{ method: "{method}", path: "{path_str}" }},')

    client_code.extend([
        "    };",
        "    return routes[opId] || { method: 'GET', path: '/health' };",
        "  }",
        "}",
        "",
        "export const defaultContractClient = new ContractApiClient();",
        "",
        'export * from "./schema";',
    ])

    client_file = OUTPUT_DIR / "index.ts"
    with open(client_file, "w", encoding="utf-8") as f:
        f.write("\n".join(client_code))
    print(f"Generated {client_file}")

if __name__ == "__main__":
    main()
