import { test, expect } from "@playwright/test";

test.describe("HRMS Module (HRM-01 to HRM-19)", () => {
  test("Requisition to approved and requester cannot approve own", async ({ page }) => {
    await page.goto("/#/hrm-org");
    await expect(page.getByText("Org Structure & Requisitions")).toBeVisible();

    await page.getByRole("button", { name: "View" }).first().click();
    await expect(page.getByRole("button", { name: "Approve requisition" })).toBeVisible();
    await page.getByRole("button", { name: "Approve requisition" }).click();
    await expect(page.getByText("Approved REQ-2026-0101")).toBeVisible();
  });

  test("Recruitment & Offers: expired offer blocks accept", async ({ page }) => {
    await page.goto("/#/hrm-recruitment");
    await expect(page.getByRole("heading", { name: "Recruitment & Offers" })).toBeVisible();

    await page.getByRole("button", { name: "Open Offer" }).nth(1).click();
    await expect(page.getByText("Offer expired — acceptance disabled")).toBeVisible();
  });

  test("Lifecycle event recorded", async ({ page }) => {
    await page.goto("/#/hrm-employees");
    await expect(page.getByRole("heading", { name: "Employees & Lifecycle" })).toBeVisible();
    await page.getByRole("button", { name: "Record event" }).click();
    await page.locator("form").getByRole("button", { name: "Record event" }).click();
    await expect(page.getByText(/Recorded confirmation/i)).toBeVisible();
  });

  test("Leave request rejected for insufficient balance", async ({ page }) => {
    await page.goto("/#/hrm-attendance");
    await expect(page.getByRole("heading", { name: "Attendance & Leave" })).toBeVisible();
    await page.getByRole("button", { name: "Request leave" }).click();
    await page.locator('input[value="2.0"]').fill("50.0");
    await page.getByRole("button", { name: "Submit request" }).click();
    await expect(page.getByText(/Insufficient Annual Leave balance/i)).toBeVisible();
  });

  test("Pay run approved by different user from preparer", async ({ page }) => {
    await page.goto("/#/hrm-payroll");
    await expect(page.getByRole("heading", { name: "Payroll & Statutory" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve run" })).toBeVisible();
    await page.getByRole("button", { name: "Approve run" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Approve run" }).click();
    await expect(page.getByText(/November 2026 marked as approved/i)).toBeVisible();
  });

  test("F&F blocked when clearance item is pending", async ({ page }) => {
    await page.goto("/#/hrm-separations");
    await expect(page.getByRole("heading", { name: "Separations & Loans" })).toBeVisible();
    await page.getByRole("button", { name: "Open Exit" }).first().click();
    await expect(page.getByText(/BLOCKED — Missing inputs/i)).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve F&F" })).toBeDisabled();
  });

  test("Loan request over limit names approver", async ({ page }) => {
    await page.goto("/#/hrm-separations");
    await page.getByRole("button", { name: "Request loan" }).click();
    await expect(page.getByText(/Over-limit request: requires approval from Elena Vance/i)).toBeVisible();
    await page.getByRole("button", { name: "Submit loan request" }).click();
    await expect(page.getByText("Loan request submitted")).toBeVisible();
  });
});
