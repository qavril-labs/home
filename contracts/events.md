# Domain Events Specification

The asynchronous and transactional events emitted across QAVRIL LABS services. Domain events are persisted and dispatched through the transactional outbox (`packages/events`).

## Event Structure

Every event conforms to the standard envelope:

```typescript
export interface DomainEvent<T = Record<string, unknown>> {
  id: string; // unique UUID v7 or ULID
  tenantId: string; // isolated tenant
  type: string; // dot-notated event name, e.g. "ledger.entry.posted"
  version: number; // schema version (starts at 1)
  occurredAt: string; // ISO 8601 UTC timestamp
  producer: string; // service identifier, e.g. "@erp/api"
  correlationId?: string; // causal tracing ID
  data: T; // strongly-typed payload
}
```

---

## Catalog of Events

### 1. Identity & Tenancy
- **`tenant.provisioned`**: Emitted when a new self-service or platform tenant is created.
  - `tenantId`: string
  - `slug`: string
  - `companyId`: string
  - `baseCurrency`: string
  - `ownerEmail`: string
- **`user.signed_up`**: Owner or staff member created.
  - `userId`: string
  - `email`: string
  - `role`: string
- **`user.logged_in`**: Session token issued.
  - `userId`: string
  - `ip`: string
  - `timestamp`: string

### 2. General Ledger (`FIN-01`)
- **`ledger.starter_books.opened`**: Emitted when starter chart of accounts and first fiscal year are configured.
  - `companyId`: string
  - `fiscalYear`: number
  - `accountCount`: number
- **`ledger.entry.posted`**: Emitted whenever a journal transaction posts to the double-entry books.
  - `entryId`: string
  - `reference`: string
  - `date`: string
  - `lines`: Array<{ account: string; side: "DEBIT" | "CREDIT"; amount: string }>
  - `totalAmount`: string
  - `source`: "quick_entry" | "manual" | "migration" | "bot"
- **`ledger.entry.reversed`**: Emitted when an entry is immutably reversed.
  - `originalEntryId`: string
  - `reversalEntryId`: string
  - `reason`: string
- **`ledger.period.locked`**: Month-end or year-end period closing.
  - `periodId`: string
  - `startDate`: string
  - `endDate`: string
  - `closedBy`: string

### 3. Master Data (`MDM-01`, `MDM-02`)
- **`party.created` / `party.updated`**: Customer or supplier created/edited.
  - `partyId`: string
  - `name`: string
  - `type`: "customer" | "supplier" | "both"
  - `taxId`?: string
- **`item.created` / `item.updated`**: Inventory item, good, or service created/edited.
  - `itemId`: string
  - `sku`: string
  - `name`: string
  - `unitPrice`: string
  - `type`: "goods" | "service" | "bundle"

### 4. Autonomous Bot Signals (`services/uaap/`)
- **`bot.signal.detected`**: A bot scanner detected an actionable event.
  - `botId`: "lou" | "chloe" | "finn" | "gus" | "pip" | "rex"
  - `severity`: "info" | "watch" | "act"
  - `message`: string
- **`bot.action.drafted`**: Bot created a draft awaiting user approval.
  - `draftId`: string
  - `botId`: string
  - `actionType`: "whatsapp_reminder" | "purchase_order" | "anomaly_review"
  - `payload`: Record<string, unknown>
- **`bot.action.approved`**: User clicked approve on a bot action.
  - `draftId`: string
  - `approvedBy`: string
  - `executedAt`: string

---

## Consumer Guarantees
1. **At-least-once delivery**: Consumers must be idempotent using `event.id`.
2. **Tenant isolation**: Outbox polling and BullMQ workers partition queues by `tenantId`.
3. **Immutability**: Event payloads cannot be mutated after emission.
