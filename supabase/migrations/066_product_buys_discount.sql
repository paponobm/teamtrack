-- Product Buy's Add/Edit form now collects Product Price and Discount Price separately
-- (src/app/(dashboard)/advance-management/page.tsx) instead of one lump "Total Amount" — these
-- two are stored so the form can be edited without losing the breakdown, while `amount` (the
-- figure every downstream consumer already reads — Salary Sheet's Product Buy column, Paid/
-- Due, Finance Hub summaries) stays the single authoritative deducted value, computed
-- server-side as product_price - discount_price (see POST/PUT /api/product-buys) so it can
-- never drift from the two inputs that produced it.
-- product_price is nullable: existing records predate this split and have no recorded
-- breakdown — the edit form falls back to product_price = amount, discount_price = 0 for those.
ALTER TABLE public.product_buys
    ADD COLUMN product_price NUMERIC(10,2) NULL,
    ADD COLUMN discount_price NUMERIC(10,2) NOT NULL DEFAULT 0;
