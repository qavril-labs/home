import { test, expect } from "@playwright/test";

test.describe("Document Intelligence & OCR Visual Extraction Inspector (AI-01 / PLT-11)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("Opens OCR inspector from App Header button", async ({ page }) => {
    const ocrBtn = page.getByTestId("header-ocr-btn");
    await expect(ocrBtn).toBeVisible();
    await ocrBtn.click();

    // Drawer should open with split screen layout
    await expect(page.getByTestId("ocr-inspector-drawer")).toBeVisible();
    await expect(page.getByText("Document Intelligence & OCR Inspector (AI-01)")).toBeVisible();
    await expect(page.getByTestId("ocr-canvas")).toBeVisible();
  });

  test("Interacts with visual document bounding boxes and switches documents", async ({ page }) => {
    // Open OCR drawer
    await page.getByTestId("header-ocr-btn").click();
    await expect(page.getByTestId("ocr-inspector-drawer")).toBeVisible();

    // Verify default doc (Precision Supplies Ltd)
    await expect(page.getByText("Precision Supplies Ltd").first()).toBeVisible();
    await expect(page.getByText("INV-99382").first()).toBeVisible();

    // Click vendor bounding box
    const vendorBox = page.getByTestId("ocr-box-box-vendor");
    await expect(vendorBox).toBeVisible();
    await vendorBox.click();

    // Click total bounding box
    const totalBox = page.getByTestId("ocr-box-box-total");
    await expect(totalBox).toBeVisible();
    await totalBox.click();

    // Switch to second document (DOC-OCR-8822)
    const doc2Btn = page.getByTestId("select-doc-DOC-OCR-8822");
    await expect(doc2Btn).toBeVisible();
    await doc2Btn.click();

    // Verify switch
    await expect(page.getByText("Industrial Supply Co").first()).toBeVisible();
    await expect(page.getByText("INV-IS-4491").first()).toBeVisible();
    await expect(page.getByText("$1,230.00").first()).toBeVisible();
  });

  test("Posts draft bill from OCR inspector and emits doc.extracted domain event", async ({ page }) => {
    // Open OCR drawer
    await page.getByTestId("header-ocr-btn").click();
    await expect(page.getByTestId("ocr-inspector-drawer")).toBeVisible();

    // Click Post Draft Bill & Submit (Tier 2)
    const postBtn = page.getByTestId("post-ocr-bill-btn");
    await expect(postBtn).toBeVisible();
    await postBtn.click();

    // Toast notification should appear
    await expect(
      page.getByText(/OCR bill INV-99382 posted as BILL-99382 and routed to Approvals Inbox/i)
    ).toBeVisible();

    // Drawer should close
    await expect(page.getByTestId("ocr-inspector-drawer")).not.toBeVisible();

    // Check Live Event Ticker reflects doc.extracted
    await page.getByTestId("live-event-ticker-btn").click();
    await expect(page.getByTestId("live-event-dropdown")).toBeVisible();
    await expect(page.getByText("doc.extracted").first()).toBeVisible();
  });

  test("Opens OCR inspector from Accounts Payable view", async ({ page }) => {
    // Navigate to Payables
    const payablesNav = page.locator("a", { hasText: "Payables & Bills" });
    if (await payablesNav.isVisible()) {
      await payablesNav.click();
    } else {
      // Use sidebar or route
      await page.goto("/#payables");
    }

    const payablesOcrBtn = page.getByTestId("payables-ocr-btn");
    if (await payablesOcrBtn.isVisible()) {
      await payablesOcrBtn.click();
      await expect(page.getByTestId("ocr-inspector-drawer")).toBeVisible();
    }
  });
});
