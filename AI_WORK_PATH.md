# AI Work Path

> Generated: 2026-05-14 17:02:52
> Parser confidence: 87%

## Project Snapshot

- **Project:** DISPATCHER TOOL
- **Type:** Static / Vanilla Web App
- **Framework:** Vanilla HTML/JS
- **Package manager:** unknown
- **Run:** `(not detected)`
- **Build:** `(not detected)`
- **Test:** `(not detected)`

## User Goal

- I am trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE
- I am trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE
- TRUCK/DISPATCH CHARGE cannot be removed — set to 0 but still shows $250 on the invoice

## Parsed Work Items

### Bugs
- [ ] I am trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE
- [ ] No Tax on Invoice: Contractors cannot add sales tax to their invoice for labor or materials in this scenario
- [ ] I am trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE
- [ ] No Tax on Invoice: Contractors cannot add sales tax to their invoice for labor or materials in this scenario
- [ ] TRUCK/DISPATCH CHARGE cannot be removed — set to 0 but still shows $250 on the invoice

### UI / Layout Changes
- [ ] I have it set to 0 but it is still showing up $250
- [ ] Also, would you be able to make the description field wider on it
- [ ] I have always had the tax included in my price but never shown it on the invoice for a replacement or new construction job
- [ ] I have it set to 0 but it is still showing up $250
- [ ] Also, would you be able to make the description field wider on it
- [ ] I have always had the tax included in my price but never shown it on the invoice for a replacement or new construction job
- [ ] TRUCK/DISPATCH CHARGE cannot be removed — set to 0 but still shows $250 on the invoice
- [ ] Make the description field wider
- [ ] Move lead time, unit price, and amount columns closer together — currently looks smooshed
- [ ] Add a toggle to show/hide tax line on the invoice
- [ ] For repairs, tax IS shown on invoice

### Business Logic Changes
- [ ] I am trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE
- [ ] It looks smooshed on the page to me, can the lead time, unit price and amount be put closer together
- [ ] Last is the Tax, from my understanding, In Wisconsin, furnace replacements are considered real property improvements, meaning the contractor is treated as the consumer of the materials
- [ ] Therefore, you generally do not pay sales tax on the total invoice, but the contractor must pay sales tax on their purchase of the furnace unit
- [ ] Key details regarding Wisconsin furnace taxes: Contractor Liability: The contractor pays the tax when they purchase the furnace, not you
- [ ] They often pass this cost on to you within their total price
- [ ] No Tax on Invoice: Contractors cannot add sales tax to their invoice for labor or materials in this scenario
- [ ] Replacement: If a contractor is just repairing a furnace, the entire invoice for parts and labor is generally taxable
- [ ] I have always had the tax included in my price but never shown it on the invoice for a replacement or new construction job
- [ ] Can you make it so we can take it off the invoice
- [ ] I am trying the quoting tool again but I still cannot remove the TRUCK/DISPATCH CHARGE
- [ ] It looks smooshed on the page to me, can the lead time, unit price and amount be put closer together
- [ ] Last is the Tax, from my understanding, In Wisconsin, furnace replacements are considered real property improvements, meaning the contractor is treated as the consumer of the materials
- [ ] Therefore, you generally do not pay sales tax on the total invoice, but the contractor must pay sales tax on their purchase of the furnace unit
- [ ] Key details regarding Wisconsin furnace taxes: Contractor Liability: The contractor pays the tax when they purchase the furnace, not you
- [ ] They often pass this cost on to you within their total price
- [ ] No Tax on Invoice: Contractors cannot add sales tax to their invoice for labor or materials in this scenario
- [ ] Replacement: If a contractor is just repairing a furnace, the entire invoice for parts and labor is generally taxable
- [ ] I have always had the tax included in my price but never shown it on the invoice for a replacement or new construction job
- [ ] Can you make it so we can take it off the invoice
- [ ] TRUCK/DISPATCH CHARGE cannot be removed — set to 0 but still shows $250 on the invoice
- [ ] Move lead time, unit price, and amount columns closer together — currently looks smooshed
- [ ] Add a toggle to show/hide tax line on the invoice
- [ ] For replacement or new construction jobs, tax is included in the price but should not appear as a separate line item
- [ ] For repairs, tax IS shown on invoice
- [ ] html, invoice

### Config / Documentation / Other
- [ ] Another thing is are we able use the return key to start a new line
- [ ] Right now it just ends where the description field ends and cuts sentences up kind of weird sometimes
- [ ] Another thing is are we able use the return key to start a new line
- [ ] Right now it just ends where the description field ends and cuts sentences up kind of weird sometimes
- [ ] Enable return key (Enter) to start a new line in the description field — currently text just cuts off at field boundary

## Business Rules

- I have always had the tax included in my price but never shown it on the invoice for a replacement or new construction job
- I have always had the tax included in my price but never shown it on the invoice for a replacement or new construction job

## Likely Files To Inspect

- `index.html`
- `invoice.js`

## Guardrails

- Preserve existing functionality
- Avoid unrelated edits
- Ask before risky changes
- Do not auto-deploy
- Do not auto-commit
- ⚠️ Business-critical financial logic involved — verify calculations carefully
- ⚠️ Destructive operation mentioned — ensure safety checks
- ⚠️ Business-critical financial logic involved — verify calculations carefully
- ⚠️ Destructive operation mentioned — ensure safety checks
- ⚠️ Business-critical financial logic involved — verify calculations carefully
- ⚠️ Destructive operation mentioned — ensure safety checks

## Verification Plan

- [ ] Check browser console for errors

## Confidence Reporting

After AI work completes, report:
- Files changed
- Tests run and results
- Console errors found
- Screenshots captured (if applicable)
- Confidence score (0-100%)
- Escalation reasoning (if confidence < 80%)
