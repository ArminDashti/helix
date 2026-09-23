# Database catalog

The analysis target is the database configured in **Settings** (engine, host, database, credentials). Its schema is introspected at run time and injected into every agent prompt as **Live catalog** — that is the authoritative object and column list for any SELECT.

Never invent tables, views, or columns. Prefer the live catalog over anything written here. Each documented object below carries an **Overview** (`- **Description:**` line): a brief statement of what the table holds and how it is meant to be used — read it before you query the table and follow it.

## Query speed

- Filter the driving / fact table first with sargable predicates on keys the user named.
- Bound every SELECT with `TOP`, `FETCH`, or `LIMIT` unless config allows otherwise.
- Join lookup tables only for display columns; resolve names to ids on small lookups.
- Default to a recent time window when the user did not ask for all history.
- Rankings: filter, aggregate, window rank, keep the top row per group, outer bound.

## Catalog

Document your own objects below as sections named exactly `schema.table`. A documented section is kept in the prompt only while that object exists in the connected database, so this file stays valid across engines and databases.

## AssetAccounting.ForoshAmval

- **Kind:** table
- **Description:** Header records of asset sale (disposal) forms: form number/date, selling cost, deposit amount, distribution-center cost center and detail-account posting.
## AssetAccounting.ForoshAmvalSatr

- **Kind:** table
- **Description:** Line items of asset sale forms: each asset sold with its price, book value and related depreciation code.
## AssetAccounting.vForoshAmval

- **Kind:** view
- **Description:** View of asset sale headers enriched with detail-account and cost-center names plus formatted form dates.
## AssetAccounting.vForoshAmvalSatr

- **Kind:** view
- **Description:** View of asset sale lines with asset name/serial number, book value, sale price and accumulated depreciation.
## BI.vwDimSalesDocumentType

- **Kind:** view
- **Description:** BI dimension of sales document types (ID and title) used to classify sales documents.
## BI.vwDimSalesKind

- **Kind:** view
- **Description:** BI dimension of sales kinds (ID and title).
## BI.vwFactSales

- **Kind:** view
- **Description:** BI fact view of sales invoice lines: quantities, prices, discounts, VAT and multiple price tiers (factory/pharmacy/consumer) linked to date, customer, product, branch and currency dimensions.
## BI.vwFactSalesTarget

- **Kind:** view
- **Description:** BI fact view of sales targets (target count and amount) by date, kind, product, branch, supplier, unit and currency.
## Convert.TblCalcSaleMnth

- **Kind:** table
- **Description:** Monthly sales calculation scratch table keyed by container, product, month and calculation step.
## Managment.ForoshMojodyRooz

- **Kind:** table
- **Description:** Daily management snapshot of sales quantity versus stock quantity per product, including how many distribution centers hold stock.
## Managment.ForoshandehKholasehAmalkardMahaneh

- **Kind:** table
- **Description:** Monthly salesperson performance summary per distribution center and sales group: sales amount, invoice count and returned amount.
## PPC.vSalesRatio

- **Kind:** view
- **Description:** View of per-product sales ratios with product/generic codes, distribution center and modifying user — input for production planning (PPC).
## Sales.ATedadFaktor

- **Kind:** view
- **Description:** Aggregate count of invoices per order request, product, product type, invoice date and transport type.
## Sales.ATedadKardex

- **Kind:** view
- **Description:** Aggregate count of stock-ledger (kardex) entries per product and reference.
## Sales.AVG6MahForPotential

- **Kind:** table
- **Description:** Six-month average sales per distribution center, supplier and customer, used for potential-customer calculations.
## Sales.AdamDarkhast

- **Kind:** table
- **Description:** Records of no-order (unfulfilled request) visits: region, salesperson, customer, visit time, status and entry source.
## Sales.AdamDarkhastSatr

- **Kind:** table
- **Description:** Detail lines of no-order records carrying the reason and status of each entry.
## Sales.AeenNamehJaizehForosh03RialeDastehbandiJaizeh

- **Kind:** table
- **Description:** Sales award letter rule table: score ranges (EmtiazAz/EmtiazTa) mapped to award rial amounts per award grouping, effective from a start date.
## Sales.BranchShare

- **Kind:** table
- **Description:** Monthly supplier share per distribution center and region for a given year.
## Sales.ChanelShare

- **Kind:** table
- **Description:** Monthly sales-channel share per supplier and product.
## Sales.ChanelShareMarkazPakhsh

- **Kind:** table
- **Description:** Monthly sales-channel share per distribution center.
## Sales.ChanelShareSupplier

- **Kind:** table
- **Description:** Monthly sales-channel share per supplier.
## Sales.CodeMashin

- **Kind:** table
- **Description:** Vehicle (machine) code lookup per distribution center.
## Sales.CollectionTargetsChecks

- **Kind:** table
- **Description:** Collection target checks per year-month, distribution center and salesperson, split by governmental customers: open-invoice count and amount.
## Sales.CollectionTargetsChecks_Mahane

- **Kind:** table
- **Description:** Monthly variant of Sales.CollectionTargetsChecks with the same open-invoice target structure.
## Sales.ConvertRotbeForoshandeh

- **Kind:** table
- **Description:** Converts/normalizes salesperson ranking per year, month, distribution center and salesperson with position code, supervision group and seller type.
## Sales.DarkhastFaktor

- **Kind:** table
- **Description:** Header of invoice request orders: customer, salesperson, region, request/invoice/dispatch dates, credit, transport, status, request and invoice totals with discounts.
## Sales.DarkhastFaktorEstemhal

- **Kind:** table
- **Description:** Deferral (postponement) requests for invoice orders: delay days, permit code/date/issuer, assignee, status, deferral type and break flag.
## Sales.DarkhastFaktorEstemhal_TaminKonandeh

- **Kind:** table
- **Description:** Supplier-side deferral records for invoice orders: delay days, permit approval and supplier reference.
## Sales.DarkhastFaktorLastVazeiat

- **Kind:** table
- **Description:** Latest status code per invoice request order and year.
## Sales.DarkhastFaktorMohasebehTakhfifJayzeh

- **Kind:** table
- **Description:** Stores the computed prize-discount calculation result per invoice request.
## Sales.DarkhastFaktorNotKala

- **Kind:** table
- **Description:** Goods shortage notes against an invoice request: requested versus available quantity per product with reason type.
## Sales.DarkhastFaktorOptime

- **Kind:** table
- **Description:** Optimization token log per invoice request (token and creation time).
## Sales.DarkhastFaktorSatr

- **Kind:** table
- **Description:** Line items of invoice requests: product, batch, production/expiry dates, quantities, prices, discounts, sellable stock and status.
## Sales.DarkhastFaktorSatrBACKUP

- **Kind:** table
- **Description:** Backup copy of Sales.DarkhastFaktorSatr (invoice request line items).
## Sales.DarkhastFaktorSatrInValid

- **Kind:** table
- **Description:** Archive of invalidated invoice request line items.
## Sales.DarkhastFaktorSatrTakhfif

- **Kind:** table
- **Description:** Discount lines applied to an invoice request line: discount type, percent, amount and total.
## Sales.DarkhastFaktorSatrTemp

- **Kind:** table
- **Description:** Temporary working copy of invoice request line items.
## Sales.DarkhastFaktorSatr_Delete

- **Kind:** table
- **Description:** Audit of deleted invoice request lines: product, quantity, deletion reason, user, customer and whether the whole invoice was deleted.
## Sales.DarkhastFaktorTakhfif

- **Kind:** table
- **Description:** Header-level discounts for an invoice request: discount type, percent, amount and total.
## Sales.DarkhastFaktorTashilatModatVosol

- **Kind:** table
- **Description:** Payment facilities / collection grace period attached to an invoice request (facility code, postdated-check reference, Thursday day).
## Sales.DarkhastFaktorVazeiat

- **Kind:** table
- **Description:** Status history of an invoice request: status code, timestamp, user and returned-from-distribution flag.
## Sales.DarkhastFaktor_TakhfifKharidNaghdy

- **Kind:** table
- **Description:** Cash-purchase discount applied to an invoice request, linked to a receipt/payment record, with amount, status and effective collection term.
## Sales.DastehBandyJaizehForosh

- **Kind:** table
- **Description:** Lookup of sales award groupings (names).
## Sales.DentalTarget

- **Kind:** table
- **Description:** Monthly dental-channel sales target per branch with Shamsi and Gregorian dates.
## Sales.Ehda

- **Kind:** table
- **Description:** Header of endowment/donation (Ehda) declarations with description and validity period.
## Sales.EhdaSatr

- **Kind:** table
- **Description:** Line items of endowment declarations: field type, batch, production/expiry dates and endowed quantity.
## Sales.ElamMarjoee

- **Kind:** table
- **Description:** Header of customer return (Marjoee) declarations: region, salesperson, customer, related invoice request, next-invoice link, status and reason.
## Sales.ElamMarjoeeSatr

- **Kind:** table
- **Description:** Line items of return declarations: product, batch, quantities, fee, return reason and return type.
## Sales.ElatAdamDarkhast

- **Kind:** table
- **Description:** Lookup of reasons for no-order (Adam Darkhast) entries.
## Sales.ElatAdamFaalMoshtary

- **Kind:** table
- **Description:** Lookup of reasons why a customer is inactive.
## Sales.ElatAdamForoshMarkazPakhsh

- **Kind:** table
- **Description:** Lookup of reasons for no-sales at a distribution center, with unit code.
## Sales.ElatBlocked

- **Kind:** table
- **Description:** Lookup of blocking reasons with day and date.
## Sales.ElatMarjoee

- **Kind:** table
- **Description:** Lookup of return (marjoee) reasons.
## Sales.Emphatic

- **Kind:** table
- **Description:** Monthly emphasis (focus) product targets per distribution center and salesperson, grouped and based on pack count.
## Sales.EmphaticTaminKonandeh

- **Kind:** table
- **Description:** Monthly supplier emphasis share: percentage and hospital/pharmacy weights per supplier, center and salesperson.
## Sales.EmphaticTaminKonandehException

- **Kind:** table
- **Description:** Exception products excluded from supplier emphasis targets (year, month, product).
## Sales.ErsalEshantionTaminKonanhde

- **Kind:** table
- **Description:** Monthly supplier incentive (eshantion) submission: rial amount, tax/levy, status, official letter number/date and user.
## Sales.ErsalEshantionTaminKonanhdeFiles

- **Kind:** table
- **Description:** Attachment files for supplier incentive submissions (path, description, web address).
## Sales.ErsalEshantionTaminKonanhdeSendToAfrad

- **Kind:** table
- **Description:** Recipients of supplier incentive submission notifications.
## Sales.ErsalGheymatTaminKonanhdeFiles

- **Kind:** table
- **Description:** Attachment files for supplier price-submission documents, per product.
## Sales.ErsalPadashForoshTaminKonanhde

- **Kind:** table
- **Description:** Monthly supplier sales-reward submission: rial rewards (Pelekani/Moredi), status, letter details and appreciation letters.
## Sales.ErsalPadashForoshTaminKonanhdeFiles

- **Kind:** table
- **Description:** Attachment files for supplier sales-reward submissions.
## Sales.ErsalPadashForoshTaminKonanhdeSendToAfrad

- **Kind:** table
- **Description:** Recipients of supplier sales-reward submission notifications.
## Sales.ErsalTakhfifatRialiMoshtarianBeHesabTaminKonandeh

- **Kind:** table
- **Description:** Monthly transfer of customers' cash discounts to a supplier account: amount, status and official letter details.
## Sales.ErsalTakhfifatRialiMoshtarianBeHesabTaminKonandehFiles

- **Kind:** table
- **Description:** Attachment files for cash-discount transfer submissions to suppliers.
## Sales.ErsalTakhfifatRialiMoshtarianBeHesabTaminKonandehSendToAfrad

- **Kind:** table
- **Description:** Recipients of cash-discount transfer notifications.
## Sales.Estemhal

- **Kind:** table
- **Description:** Deferral (postponement) record against an invoice request: deferral date, responsible person, permit number/date/issuer, description, attachment and control flag.
## Sales.EtebarMojazAeenNameh

- **Kind:** table
- **Description:** Credit line allowed by official letter: credit level, max rial/count limits, validity period, status, reason and group.
## Sales.EtebarMoshtary

- **Kind:** table
- **Description:** Customer credit assessment: purchase and return history, net amounts, outstanding balance, risk/ownership coefficients, credit limit, bounced checks, block status and customer grade.
## Sales.EtebarMoshtaryAsnadDarJaryanVosol

- **Kind:** table
- **Description:** Customer credit snapshot of documents in collection: credit amounts, overdue variance and close date per period.
## Sales.EtebarMoshtaryException

- **Kind:** table
- **Description:** Customers exempt from credit checks (customer code list).
## Sales.EtebarMoshtaryKharidNakardeh

- **Kind:** table
- **Description:** Customers flagged as not purchasing within a date range, with status.
## Sales.EtebarMoshtaryLog

- **Kind:** table
- **Description:** Audit log of customer credit changes: user, date, customer, description and manager type.
## Sales.EtebarMoshtaryMahaneh

- **Kind:** table
- **Description:** Monthly credit limit per customer for a date range and year/month.
## Sales.EtebarMoshtaryMahanehDetail

- **Kind:** table
- **Description:** Detail of monthly customer credit allocations linked to invoice requests.
## Sales.EtebarMoshtaryMahanehOndpline

- **Kind:** table
- **Description:** Online variant of monthly customer credit: monthly limit plus current credit level.
## Sales.EtebarMoshtaryTemp

- **Kind:** table
- **Description:** Temporary customer credit figures during recalculation: temp limit, change amount, status, reason and linked request/payment.
## Sales.ExpireDateTarget

- **Kind:** table
- **Description:** Monthly expiry-date targets (two targets) per distribution center.
## Sales.FactForcastBase

- **Kind:** table
- **Description:** Base sales forecast per month, region, customer, center, supplier and salesperson with forecast value and branch.
## Sales.FactForcastSec

- **Kind:** table
- **Description:** Secondary (refined) sales forecast per month, center, customer and salesperson.
## Sales.FactHadaf

- **Kind:** table
- **Description:** Sales targets (quantity and rial) per year, month, region, channel, center, supplier, salesperson and product.
## Sales.FactHadafKol

- **Kind:** table
- **Description:** Aggregate rial sales target per customer, center and salesperson with entry audit.
## Sales.FactHadafTPCO

- **Kind:** table
- **Description:** Rial sales target keyed by TPCO customer code per period, region, center and salesperson.
## Sales.FactHadafTopKala

- **Kind:** table
- **Description:** Top-product sales targets (quantity and rial) per customer, center, supplier and product.
## Sales.FactHadafTopSupplier

- **Kind:** table
- **Description:** Rial sales targets for top suppliers per customer, center and salesperson.
## Sales.FactPotential

- **Kind:** table
- **Description:** Customer potential value per center and supplier with normalization factor, year/month and active-customer flag.
## Sales.ForGozareshMoshtarianKharidNakardeh

- **Kind:** table
- **Description:** Working list of customers feeding the 'customers who did not purchase' report (customer codes).
## Sales.Forosh1MahForPotential

- **Kind:** table
- **Description:** One-month sales amount per customer, center and supplier used in potential calculations.
## Sales.ForoshForPotential

- **Kind:** table
- **Description:** Sales amount and six-month average per customer for potential calculations.
## Sales.ForoshKalaForSahmiehBandi

- **Kind:** table
- **Description:** Net product sales quantities over the last 6/3/1/0 months per distribution center, used for share allocation.
## Sales.ForoshTedadiRialyTablet

- **Kind:** table
- **Description:** Quantity and rial sales captured via tablet per year, center, salesperson, customer and product.
## Sales.Foroshandeh

- **Kind:** table
- **Description:** Salesperson master data per distribution center: type, allowed days, bounced-check and open-invoice limits, status, sales group, contact and device info.
## Sales.ForoshandehBeForoshandeh

- **Kind:** table
- **Description:** Mapping of one salesperson to another (delegation/coverage) for a date range.
## Sales.ForoshandehKalaSahmiehBandy

- **Kind:** table
- **Description:** Per-salesperson product share allocation: ratio, stock quantity, validity period, status and reason.
## Sales.ForoshandehMoshtary

- **Kind:** table
- **Description:** Salesperson–customer assignment: route, visit day, priority, status, inactivity reason and credit-block flags.
## Sales.ForoshandehMoshtaryHistory

- **Kind:** table
- **Description:** History/audit of salesperson–customer assignments: previous values, edit type, dates, user and block reason.
## Sales.ForoshandehMoshtaryMasirHistory

- **Kind:** table
- **Description:** History of route changes for a salesperson's customer: old/new salesperson and route, action description, type, user and date.
## Sales.ForoshandehNoeMoshtary

- **Kind:** table
- **Description:** Validity periods during which a sales rep (Foroshandeh) serves a specific customer type within a group, including status code and reason.
## Sales.GetSharhFile

- **Kind:** table
- **Description:** Small lookup of file-description codes (ccSharhFile) and their titles.
## Sales.GorohForosh

- **Kind:** table
- **Description:** Sales-group definition per distribution center, holding the group code, title, assigned personnel and status code.
## Sales.GorohOlaviatTozih

- **Kind:** table
- **Description:** Priority-group explanation text: maps a group explanation record to its parent group.
## Sales.GorohTahtehNazar

- **Kind:** table
- **Description:** Associates an under-consideration group with a distribution center (review/monitoring grouping).
## Sales.HIXCodeFaktor

- **Kind:** table
- **Description:** Links invoice-request documents to their HIX tracking codes, with ledger reference, dispatch/cancel dates, status and order HIX code.
## Sales.HIXProduct

- **Kind:** table
- **Description:** Per-product HIX submission record tracking dispatch of stock, price and activation statuses with dates and comments.
## Sales.HadafForoshandeh_DP

- **Kind:** table
- **Description:** Distributes a distribution-center sales target across sales reps as percentage shares.
## Sales.HadafForoshandeh_PG

- **Kind:** table
- **Description:** Per-rep, per-product sales target for a period (year/month, from/to dates) with two multiplier factors.
## Sales.HadafGheyreMokamelMarakez

- **Kind:** table
- **Description:** Monthly non-covered (non-replenished) targets per distribution center, split by total, private and government channels for center, manager and salesperson levels, with multiplier coefficients, status and fixed flag.
## Sales.HadafGheyreMokamelMarakezAfrad

- **Kind:** table
- **Description:** Private/government percentage breakdown of the non-covered center target allocated to individual personnel.
## Sales.HadafKalaTPCO

- **Kind:** table
- **Description:** Yearly, versioned quantity target per product code under a sales target, with entry user/date and modification timestamp.
## Sales.HadafKharidLog

- **Kind:** table
- **Description:** Audit log of purchase-target changes per product, recording target/item/date keys, quantity, entry date and user.
## Sales.HadafMah_DP

- **Kind:** table
- **Description:** Monthly percentage and amount breakdown of an annual sales target.
## Sales.HadafMasir_DP

- **Kind:** table
- **Description:** Allocates a distribution-center sales target across delivery routes as percentage shares.
## Sales.HadafMokamelMarakez

- **Kind:** table
- **Description:** Monthly covered (replenished) targets per distribution center at center, manager and salesperson levels, with status code.
## Sales.HadafMokamelMarakezAfrad

- **Kind:** table
- **Description:** Per-personnel share of the covered center target, with entering user and date.
## Sales.HadafMoshtary_DP

- **Kind:** table
- **Description:** Allocates a distribution-center sales target to individual customers as percentage shares.
## Sales.HadafPelekani

- **Kind:** table
- **Description:** Monthly per-product, per-center targets expressed as seven numbered target figures (pelekani/plate values).
## Sales.HadafPelekaniHistory

- **Kind:** table
- **Description:** Historical versions of the pelekani target table, adding revision number (Noskhe) and an eighth target figure.
## Sales.HadafSalMarkazPakhsh_DP

- **Kind:** table
- **Description:** Percentage distribution of a monthly target across distribution centers.
## Sales.Hadaf_DP

- **Kind:** table
- **Description:** Annual sales target header per year and version, holding the total target amount and TPCO flag.
## Sales.Hadaf_PG

- **Kind:** table
- **Description:** Quantity sales target per product (and supplier) for a given year, month and distribution center.
## Sales.IMED_Entities

- **Kind:** table
- **Description:** Reference registry of receiving organizations (pharmacies/hospitals) with type, province/city, HIX code, medical university, license owner, GLN and code status history.
## Sales.IMED_Goods_Equipment_Type

- **Kind:** table
- **Description:** Maps product codes to their IMED goods/equipment type identifiers.
## Sales.IRC_BATCH14021119

- **Kind:** table
- **Description:** Snapshot table combining GLN, IRC and batch identifiers into an IRC_BATCH key, with entry date.
## Sales.IgnoreDuplicateInvoice

- **Kind:** table
- **Description:** Whitelist of invoice numbers per distribution center and year that must be treated as intentionally duplicated.
## Sales.Jayezeh

- **Kind:** table
- **Description:** Prize/bonus campaign header defining type, description, validity dates, quantity-or-amount basis and the customer field it applies to.
## Sales.JayezehBach

- **Kind:** table
- **Description:** Batch-based (lot) prize definition for a supplier: type, description, validity dates and quantity/amount basis.
## Sales.JayezehBachBlock

- **Kind:** table
- **Description:** Blocked/limited variant of the batch prize definition, sharing the batch prize structure.
## Sales.JayezehBachSatr

- **Kind:** table
- **Description:** Line-level rules of a batch prize: field type, ranges, classification, bonus quantities, calculation flag, modification and expiry dates.
## Sales.JayezehBachSatrBlock

- **Kind:** table
- **Description:** Blocked/limited line rules for batch prizes, with date and month ranges, expiry bounds and prize type.
## Sales.JayezehBachSatrKala

- **Kind:** table
- **Description:** Product-level prize lines of a batch prize: percentage or amount, prize product code, quantity, batch number, production and expiry dates.
## Sales.JayezehBachSatrKalaBlock

- **Kind:** table
- **Description:** Blocked/limited product lines of batch prizes: prize product code and quantity per blocked prize line.
## Sales.JayezehMorediForSanad

- **Kind:** table
- **Description:** Item-specific prize amounts calculated per accounting document, by year/month, supplier, group membership, purchase type and document date.
## Sales.JayezehNamaiesh

- **Kind:** table
- **Description:** Display/preview of prize quantities per product for a given invoice request.
## Sales.JayezehSatr

- **Kind:** table
- **Description:** Line rules of a campaign prize: field type, range, classification, bonus quantity/amount, prize product, percentage and calculation flag.
## Sales.JayezehSatrKala

- **Kind:** table
- **Description:** Product-level prize amounts/quantities granted under a prize line, with percentage, prize product code and date.
## Sales.JayezehSystemForSanad

- **Kind:** table
- **Description:** System-generated prize amounts per accounting document, by year/month, supplier, group membership, purchase type and document date.
## Sales.KalaAdamForosh

- **Kind:** table
- **Description:** No-sale (blocked product) rule per product/supplier/distribution center for a date range, split by government, social-security and private channels.
## Sales.KalaAdamForoshForoshandeh

- **Kind:** table
- **Description:** No-sale restriction on a product for a specific sales rep within a date range, keyed by personnel file number, with status and reason.
## Sales.KalaAdamForoshGorohiVahedKharid

- **Kind:** table
- **Description:** Grouped purchase-unit no-sale rule: blocks a product at a center for a customer type/customer over a date range, with status and closing date.
## Sales.KalaAdamForoshInMarkazPakhsh

- **Kind:** table
- **Description:** No-sale rule blocking a product inside a specific distribution center over a date range, with status and reason.
## Sales.KalaAdamForoshMarkazPakhsh

- **Kind:** table
- **Description:** No-sale rule per product and distribution center for a date range, optionally scoped to a customer type/customer, with status and reason.
## Sales.KalaAdamForoshShahr

- **Kind:** table
- **Description:** No-sale rule blocking a product in a given city over a date range, with status and reason.
## Sales.KalaAdamMarjoeeMarkazPakhsh

- **Kind:** table
- **Description:** Non-returnable (no-refund) rule per product and distribution center for a date range, optionally scoped to a customer type/customer.
## Sales.KalaBazPardakhtChek

- **Kind:** table
- **Description:** Check (cheque) details of a product rebate: receipt/payment link, cheque number and dates, amount, discount/surplus amounts and descriptions, allocated amount.
## Sales.KalaBazPardakhtKE

- **Kind:** table
- **Description:** Credit-note (KE) component of a product rebate: nature code, amount, description, supplier, entry user/date.
## Sales.KalaBazPardakhtMahiat

- **Kind:** table
- **Description:** Lookup of rebate/credit-note natures (Mahiat) and their names.
## Sales.KalaBazPardakhtMandehAmaniAvalDoreh

- **Kind:** table
- **Description:** Opening safe-custody (amani) balance per product at the start of a period, by year.
## Sales.KalaBazPardakhtTakhsis

- **Kind:** table
- **Description:** Allocation of a cheque or credit-note amount to a ledger/receipt record for a supplier, with allocated amount, remainder, due date and user/date stamps.
## Sales.KalaBazpardakht

- **Kind:** table
- **Description:** Product rebate record: quantities (safe/definitive), amount, due and entry dates, unit price, payment basis, contract, ledger/receipt links and financial approval, by year/month.
## Sales.KalaGheymatForosh

- **Kind:** table
- **Description:** Selling price of a product valid over a date range, with status, cancellation reason, supporting document and automatic-price flags.
## Sales.KalaGheymatForoshBCK

- **Kind:** table
- **Description:** Backup copy of the product selling-price table with identical structure to Sales.KalaGheymatForosh.
## Sales.KalaKhab

- **Kind:** table
- **Description:** Dormant/slow-moving stock analysis per product batch: supplier, stock, nearest/farthest receipt dates and quantities, definitive vs safe counts, 90-day sales and returns.
## Sales.KalaModatVosolCheck

- **Kind:** table
- **Description:** Cheque collection period rules per product and center over a date range, including credit collection period, equivalent/no-similar codes and Excel-import flag.
## Sales.KalaMojodyForoshandeh

- **Kind:** table
- **Description:** Current stock quantity of a product held by a sales rep.
## Sales.KalaMojodyGhabelForosh

- **Kind:** table
- **Description:** Sellable (available) stock quantity of a product at a distribution center, plus quantity reserved for requests.
## Sales.KalaSpecial

- **Kind:** table
- **Description:** Marks a product as special per year and month, with its generic (jenerik) code.
## Sales.KalaZaribForosh

- **Kind:** table
- **Description:** Sales multiplier coefficient for a product over a date range, tied to packaging classification, group and status with reason.
## Sales.KholasehAmalkard

- **Kind:** table
- **Description:** Daily performance summary per distribution center: carton/unit stock, undelivered invoice value and counts, and 15-day sales in rial/carton/unit terms.
## Sales.LogInsertOrDeleteKalaFromTashilatModatVosol

- **Kind:** table
- **Description:** Audit log of products inserted into or deleted from collection-facility records, with user, date and log type.
## Sales.LoyalBranchTarget

- **Kind:** table
- **Description:** Monthly loyal-customer target value per branch, with Shamsi and Miladi dates.
## Sales.MamorPakhsh

- **Kind:** table
- **Description:** Distribution officer assignment per center with limits on bounced-cheque and re-issued-invoice counts/amounts/durations, status, personnel and mobile.
## Sales.MarjoeeAmany

- **Kind:** table
- **Description:** Custody-return (amani) request status per invoice-request line, with date, status code and record key.
## Sales.MarketMessage

- **Kind:** table
- **Description:** Market/field message pushed to a rep, personnel or customer of a center, with timestamp, message body and stock-deficiency note.
## Sales.Mashin

- **Kind:** table
- **Description:** Delivery vehicle registered to a distribution center: type, ownership type, plate number, driver and traffic-pattern arm.
## Sales.Masir

- **Kind:** table
- **Description:** Delivery route definition per sales rep: name, tour length, visit pattern, start date, permitted days, depot, priority and status.
## Sales.MasirHamsan

- **Kind:** table
- **Description:** Route template (hamsan) per center and locality with priority, route type, distance-to-route and dispatch time.
## Sales.MasirHamsanSatr

- **Kind:** table
- **Description:** Locality lines of a route template with their sequence priority.
## Sales.MasirSatr

- **Kind:** table
- **Description:** Locality lines that make up a delivery route.
## Sales.MasirTozieMoshtarian

- **Kind:** table
- **Description:** Customer-distribution route name lookup per distribution center.
## Sales.Moavagh

- **Kind:** table
- **Description:** Bounced/failed transaction period (cheque or invoice request) for a customer/rep of a center, with from/to dates.
## Sales.MojavezEstemhal

- **Kind:** table
- **Description:** Delay/postponement permit for an invoice request: permit date, delay days, permit number, status, description and approval type.
## Sales.MonthShare

- **Kind:** table
- **Description:** Monthly share portion per year/month, with entering user and entry date.
## Sales.Moshtary

- **Kind:** table
- **Description:** Core customer master: name, postal/economic codes, locality, ownership type, contact details, permit/license data, grade, representative, vehicle and outlet equipment (freezer/fridge counts).
## Sales.Moshtary14030515

- **Kind:** table
- **Description:** Point-in-time snapshot of Sales.Moshtary taken on 1403/05/15 (archived copy of the customer master).
## Sales.Moshtary14040713

- **Kind:** table
- **Description:** Point-in-time snapshot of Sales.Moshtary taken on 1404/07/13 (archived copy of the customer master).
## Sales.MoshtaryAddress

- **Kind:** table
- **Description:** Customer addresses: address record, address type, locality, route type, status and legacy customer code.
## Sales.MoshtaryAddressSaatTahvil

- **Kind:** table
- **Description:** Permitted delivery-time window (from/to hours) for a customer address.
## Sales.MoshtaryAfrad

- **Kind:** table
- **Description:** Personnel linked to a customer with their role, signature authority, account-party flag, status and legacy customer code.
## Sales.MoshtaryBimarestaniTarget

- **Kind:** table
- **Description:** Flag marking a customer as a hospital target account for a given year-month key.
## Sales.MoshtaryBlockHistory

- **Kind:** table
- **Description:** History of customer blocks: user, entry time, status, comments, related receipt/payment and system.
## Sales.MoshtaryEtebar

- **Kind:** table
- **Description:** Customer credit terms over a date range: current credit, min/max and quantity limits, credit level, requested amount/quantity, status and reason.
## Sales.MoshtaryGoroh

- **Kind:** table
- **Description:** Membership of a customer in a customer group.
## Sales.MoshtaryJadid

- **Kind:** table
- **Description:** New-customer registration record: name, initial address/contact, ownership type, permit durations, responsible rep/personnel, status, entry type/date, group and locality.
## Sales.MoshtaryJadidDarkhast

- **Kind:** table
- **Description:** Request to open a new customer at a center: date, requesting rep/personnel, product, quantity, sale amount, entry type/date and status.
## Sales.MoshtaryJayezeh

- **Kind:** table
- **Description:** Links a customer to a prize/campaign, with entering user and entry date.
## Sales.MoshtaryNewTemp

- **Kind:** table
- **Description:** Temporary mapping between old and new customer codes during migration, with an inserted flag.
## Sales.MoshtaryPhoto

- **Kind:** table
- **Description:** Attaches a photo of a given photo type to a customer.
## Sales.MoshtaryRiskPotential

- **Kind:** table
- **Description:** Monthly risk-potential percentage per customer at a distribution center, by year/month.
## Sales.MoshtaryShomarehHesab

- **Kind:** table
- **Description:** Customer bank accounts: bank, branch code/name, city, cheque type, account holder, active flag, non-corporate flag and credit date.
## Sales.MoshtarySoftware

- **Kind:** table
- **Description:** Software credentials issued to a customer: software identifier, system username/password and creation date.
## Sales.MoshtaryVaziat

- **Kind:** table
- **Description:** Latest customer status record: status code, notes, recording user/time and a message-sent flag.
## Sales.MoshtaryVaziatHistory

- **Kind:** table
- **Description:** History of customer status changes: old/new status codes, recording user/time, financial reason and description.
## Sales.MoshtaryWebsitePhoto

- **Kind:** table
- **Description:** Website photo records for a customer: photo id, type and file name.
## Sales.NoeMalekiatMoshtary

- **Kind:** table
- **Description:** Lookup of customer ownership types (e.g., private, organizational) and their names.
## Sales.NoeMashin

- **Kind:** table
- **Description:** Vehicle type definitions with dimensions (length/width/height), weight and their unit codes.
## Sales.NoeMoshtaryRialKharid

- **Kind:** table
- **Description:** Lookup of customer types that apply to rial purchase rules, with the minimum purchase amount allowed per customer group.
## Sales.NoeVosolAzMoshtary

- **Kind:** table
- **Description:** Lookup of collection methods from customers (e.g. delivery/collection modes), each with a display name and priority order.
## Sales.Poorsant

- **Kind:** table
- **Description:** Sales commission rules per product: percentage or rial commission amount valid within a date range.
## Sales.PorseshNameNatayej

- **Kind:** table
- **Description:** Survey response headers: a completed questionnaire instance for a customer/distribution company, with registration date and remarks.
## Sales.PorseshNameNatayejSatr

- **Kind:** table
- **Description:** Survey response line items: the score/grade given to each question within a completed questionnaire.
## Sales.PorseshNameSatr

- **Kind:** table
- **Description:** Survey questionnaire question lines, each describing a question and linked to its questionnaire title.
## Sales.PorseshNameTitr

- **Kind:** table
- **Description:** Survey questionnaire title/definition records: code, name, registration date, and creating user.
## Sales.PrintEshantionFaktor

- **Kind:** table
- **Description:** Print requests for exception invoices: stores a distribution center, invoice-number range, fiscal year, and date range of the print job.
## Sales.PrintFaktor

- **Kind:** table
- **Description:** Print request log for invoices: distribution center, invoice-number range, fiscal year, print type, and report/file identifiers.
## Sales.PrintPishFaktor

- **Kind:** view
- **Description:** Print view combining pre-invoice (order request) data with distribution center, customer, delivery method, and seller details for report output.
## Sales.ProductItem

- **Kind:** table
- **Description:** Monthly product-item records per branch, keyed by year/month with both Shamsi and Miladi dates.
## Sales.RaasGiriCategory

- **Kind:** table
- **Description:** Category definitions for follow-up (raas-giri) modules: name, code, UI colors/icon, active flag, and display order.
## Sales.SMS2Customers

- **Kind:** table
- **Description:** Outbound SMS records to customers containing invoice/payment details (amounts, check info), with send status and birthday/foundation occasion flags.
## Sales.SMSSabadKalaErsali

- **Kind:** table
- **Description:** SMS notifications about delivery of shopping-cart goods per customer, tracking sent/received status.
## Sales.SabadGorohKala

- **Kind:** table
- **Description:** Shopping-cart product-group definitions: name and active flag.
## Sales.SabadGorohKalaSatr

- **Kind:** table
- **Description:** Line items of a product-group cart: the product group, quantity, and minimum purchase quantity in an invoice.
## Sales.SabadKala

- **Kind:** table
- **Description:** Shopping-cart (pre-order basket) definitions: name and active flag.
## Sales.SabadKalaSatr

- **Kind:** table
- **Description:** Shopping-cart line items: product, quantity, and minimum purchase quantity required in an invoice.
## Sales.SabadKalasms

- **Kind:** table
- **Description:** SMS cart campaign definitions with status code, active date range, owning user, and message text.
## Sales.SabadKalasmsJayeze

- **Kind:** table
- **Description:** Prize products awarded by an SMS cart campaign: maps a purchased product to a reward product and quantity.
## Sales.SabadKalasmsSatr

- **Kind:** table
- **Description:** SMS cart campaign line items holding staged calculation values (price, purchase cost, discounts, tax, levy, net amount) per product.
## Sales.SahmiehBandiTahtControlExceptions

- **Kind:** table
- **Description:** Exception entries exempting a customer from an under-control quota rule, with active flag and exception type.
## Sales.SahmiehBandySpecial

- **Kind:** table
- **Description:** Special quota allocations for a customer and product: quantity, validity dates, audit fields, and remarks.
## Sales.SahmiehBandyTahtControl

- **Kind:** table
- **Description:** Under-control quota allocations per customer and product: quantity, type/status codes, validity dates, and audit fields.
## Sales.SahmiehBandyTahtControlCodeJenerik

- **Kind:** table
- **Description:** Under-control quota allocations per customer defined by generic (therapeutic) code instead of single product.
## Sales.SahmiehBandyTahtControlDaneshgah

- **Kind:** table
- **Description:** Under-control quota allocations scoped to a university customer group and distribution center per product.
## Sales.SahmiehBandyTahtControlException

- **Kind:** table
- **Description:** Exception overrides attached to an under-control quota allocation for a customer/product within a date range.
## Sales.SahmiehBandyTahtControlForoshandeh

- **Kind:** table
- **Description:** Under-control quota allocations defined by seller: quantity, type/status, validity dates, and audit fields.
## Sales.SahmiehBandyTahtControlOstan

- **Kind:** table
- **Description:** Under-control quota allocations scoped by province (and county) and distribution center per product.
## Sales.SellerShare

- **Kind:** table
- **Description:** Seller/channel share records: the seller's share percentage per channel, region, supplier, month, and year at a distribution center.
## Sales.SendEmailToSupplier

- **Kind:** table
- **Description:** Emails sent (or queued) to a supplier regarding an order-request line: recipient, subject, body, author, and sent flag.
## Sales.SghfeEstemhal

- **Kind:** table
- **Description:** Ceiling amounts for shortage/theft (estemhal) per distribution center over a date range, with daily average.
## Sales.SharhFaktor

- **Kind:** table
- **Description:** Invoice remark/description text applicable to a distribution center within a date range.
## Sales.ShomarehFaktorJaOftadeh

- **Kind:** table
- **Description:** Audit of reassigned invoice numbers: records the old and new invoice number for an order request per distribution center.
## Sales.Sms

- **Kind:** table
- **Description:** Generic outbound SMS log: send date, mobile number, message text, and delivery status.
## Sales.Softwares

- **Kind:** table
- **Description:** Simple lookup of software names with an identifier code.
## Sales.SupplierEmails

- **Kind:** table
- **Description:** Email addresses registered for a supplier, each with an enabled flag.
## Sales.TBLMohasebehHadafPelekani

- **Kind:** table
- **Description:** Calculation results of tiered (ladder) targets per distribution center: net invoice amount, reward amount, target, multipliers, and max values.
## Sales.TafkikJoze

- **Kind:** table
- **Description:** Piece-level dispatch/separation documents: vehicle, driver, dispatch officer, departure/return times, status, and route count per distribution center.
## Sales.TafkikJozeSatr

- **Kind:** table
- **Description:** Lines linking an order request to a piece dispatch document, within a fiscal year.
## Sales.TafkikJozeTasfieh

- **Kind:** table
- **Description:** Settlement record for a piece dispatch: totals for goods, cash, check, card, discount, returnable items, and receipts with status.
## Sales.TafkikJozeTasfiehSatr

- **Kind:** table
- **Description:** Per-order-request settlement amounts within a piece dispatch settlement (cash, check, card, discount, returnables, receipt).
## Sales.TafkikKol

- **Kind:** table
- **Description:** Master (general) dispatch/separation documents per distribution center with document number, date, and fiscal year.
## Sales.TafkikKolSatr

- **Kind:** table
- **Description:** Links piece dispatch documents under a master dispatch document.
## Sales.TahtControlGroup

- **Kind:** table
- **Description:** Under-control quota groups: name with nightly, half-shift, and daily quota counts, plus active flag.
## Sales.TahtControlGroupDetail

- **Kind:** table
- **Description:** Products belonging to an under-control quota group.
## Sales.TakhfifHajmi

- **Kind:** table
- **Description:** Volume discount definitions: date range, from/to thresholds, discount percentage, customer-field criteria, and responsibility type.
## Sales.TakhfifHajmiSatr

- **Kind:** table
- **Description:** Line-level bands of a volume discount: quantity range, bundling type, extra quantity, and discount percentage.
## Sales.TakhfifHamlMostaghim

- **Kind:** table
- **Description:** Direct freight discount definitions by supplier and vehicle type, with vehicle amount/volume/weight and discount percentage over a date range.
## Sales.TakhfifHamlMostaghimHistory

- **Kind:** view
- **Description:** View of direct freight discounts enriched with supplier and vehicle type names (slash-free dates included) for history reporting.
## Sales.TakhfifHamlMostaghimSatr

- **Kind:** table
- **Description:** Products eligible for a direct freight discount.
## Sales.TakhfifJaiyezehMarjoee

- **Kind:** table
- **Description:** Returnable prize amounts recorded against a kardex/order request: product, quantity, amount, and prize type.
## Sales.TakhfifJayezeh

- **Kind:** table
- **Description:** Prize/bonus discount program definitions: date range, form type, criteria field, vehicle, amount-versus-count mode, and priority.
## Sales.TakhfifJayezehAdam

- **Kind:** table
- **Description:** Exclusion pairs: discount types and prize types that must not be applied together.
## Sales.TakhfifJayezehCodeNoeVorodDarkhast

- **Kind:** table
- **Description:** Restricts a prize discount to specific order-entry type codes.
## Sales.TakhfifJayezehMarkazPakhsh

- **Kind:** table
- **Description:** Distribution centers in which a prize discount applies.
## Sales.TakhfifJayezehSatr

- **Kind:** table
- **Description:** Lines of a prize discount: quantity bands, reward product/quantity, percentage, and rial prize value.
## Sales.TakhfifKharidNaghdy

- **Kind:** table
- **Description:** Cash-purchase discount definition for a date range: percentage, maximum collection period, customer type, and max daily debt ceiling.
## Sales.TakhfifNaghdy

- **Kind:** table
- **Description:** Cash discount definitions: calculation type, percentage, discount amount cap, range, and customer-field criteria.
## Sales.TakhfifSenfi

- **Kind:** table
- **Description:** Category (senf) discount definitions selected by customer-field criteria, with discount type/subtype and responsibility type over a date range.
## Sales.TakhfifSenfiSatr

- **Kind:** table
- **Description:** Line-level bands of a category discount: quantity range, bundling type, extra quantity, percentage, and discount type/subtype.
## Sales.TaminKonandehForoshMostaghim

- **Kind:** table
- **Description:** Direct-sale assignments: links an order request to a supplier, seller, and sales person with a type code.
## Sales.TaminKonandehVisitor

- **Kind:** table
- **Description:** Assigns suppliers to sales visitors (seller and personnel identifiers).
## Sales.TaminkonandeHadafMoredi

- **Kind:** table
- **Description:** Header for a supplier's periodic (moredi) sales target: supplier, year/month, validity dates, and contract (bakhshnameh) reference.
## Sales.TaminkonandeHadafMorediKala

- **Kind:** table
- **Description:** Per-product rules under a periodic supplier target: reward type, target type, sales ceiling, and calculation method.
## Sales.TaminkonandeHadafMorediMarkazpakhsh

- **Kind:** table
- **Description:** Periodic target results per distribution center: quantity and rial sales, reward, target, and achievement value.
## Sales.TaminkonandeHadafPelekani

- **Kind:** table
- **Description:** Tiered (ladder) target brackets per supplier and month: eight P0-P7 amount ranges each with its multiplier.
## Sales.TaminkonandeHadafPelekaniKalaException

- **Kind:** table
- **Description:** Products excluded from a supplier's tiered ladder target.
## Sales.TaminkonandeHadafPelekaniMP

- **Kind:** table
- **Description:** Distribution-center-specific overrides for a ladder target: percentage and per-bracket (P0-P8) multiplier values.
## Sales.TaminkonandeHadafPelekaniMPForosh

- **Kind:** table
- **Description:** Sales results used for ladder reward computation per distribution center: net invoice amount, percentage, achieved tier, and tier multiplier.
## Sales.TaminkonandeHadafPelekaniMohasebeh

- **Kind:** table
- **Description:** Ladder target calculation header: calculation type, base multiplier, supplier rial sales, percentage, and maximum amount.
## Sales.TaminkonandeHadafPelekaniMohasebehSatr

- **Kind:** table
- **Description:** Ladder calculation results per distribution center: multiplier, target, reward, supplier sales, plus max-tier multiplier/target/reward.
## Sales.TargetAghlamTakidi

- **Kind:** table
- **Description:** Confirmed stepped quantity targets by year/month, distribution center, region, channel, supplier, product, and seller.
## Sales.TargetCoverSabadKala

- **Kind:** table
- **Description:** Quantity targets for shopping-cart coverage by year/month, distribution center, region, channel, supplier, product, and seller.
## Sales.TargetDarsadForoshRooz

- **Kind:** table
- **Description:** Target daily sales percentage for a given date, recorded by a user.
## Sales.TargetDental

- **Kind:** table
- **Description:** Rial sales target for the dental line per distribution center and year/month.
## Sales.TargetExpireDate

- **Kind:** table
- **Description:** Two-tier rial targets and actual sales for near-expiry product campaigns per distribution center and year/month.
## Sales.TargetKol

- **Kind:** table
- **Description:** Overall rial sales target per supplier and month/year.
## Sales.TargetKolForoshandegan

- **Kind:** table
- **Description:** Overall rial sales targets (three variants) by year/month, distribution center, region, channel, supplier, product, and seller.
## Sales.TargetLoyalCustomer

- **Kind:** table
- **Description:** Rial sales target for loyal-customer sales per distribution center and year/month.
## Sales.TargetMokamel

- **Kind:** table
- **Description:** Rial sales targets for ointment/cream products by year/month, distribution center, region, channel, supplier, product, and seller.
## Sales.TargetNKala

- **Kind:** table
- **Description:** Quantity target per supplier, product, and month/year.
## Sales.TargetNTaminkonandeh

- **Kind:** table
- **Description:** Quantity target per supplier and month/year.
## Sales.TargetPoodrShir

- **Kind:** table
- **Description:** Rial sales targets for powder/milk products by year/month, distribution center, region, channel, supplier, product, and seller.
## Sales.TargetProductItem

- **Kind:** table
- **Description:** Quantity target per distribution center and year/month for product items.
## Sales.TargetTPCO

- **Kind:** table
- **Description:** Rial sales target for the TPCO dimension per supplier and month/year.
## Sales.TargetsChecks

- **Kind:** table
- **Description:** Target achievement monitoring: open-invoice counts and amounts per distribution center/seller, comparing first month vs. last, with zone/hospital flags.
## Sales.TarifSabadVizheForosh

- **Kind:** table
- **Description:** Special-sale basket definitions: title, validity date range, creation date, and creating person.
## Sales.TarifSabadVizheForoshDets

- **Kind:** table
- **Description:** Products included in a special-sale basket.
## Sales.TashilatModatVosol

- **Kind:** table
- **Description:** Payment-term (collection period) facility definitions: date range, criteria field, facility ceiling, status, return reason, and contract reference.
## Sales.TashilatModatVosolForoshandehBlackList

- **Kind:** table
- **Description:** Sellers blacklisted from a payment-term facility for a date range.
## Sales.TashilatModatVosolPelekan

- **Kind:** table
- **Description:** Tiered (ladder) settings of a payment-term facility: day range, installment type, discount percentage, and tier type.
## Sales.TashilatModatVosolSatr

- **Kind:** table
- **Description:** Customer-field types included in a payment-term facility.
## Sales.TashilatModatVosolSharayet

- **Kind:** table
- **Description:** Conditions attached to a payment-term facility: type, percentage, and title.
## Sales.TashilatModatVosolSharayetSatr

- **Kind:** table
- **Description:** Products and suppliers targeted by a payment-term facility condition.
## Sales.TashilatModatVosolSpecials

- **Kind:** table
- **Description:** Special customer-field types linked to a tiered payment-term facility.
## Sales.Tmp_GozareshJame_chandRadifiKala

- **Kind:** table
- **Description:** Temporary multi-row product summary report: last-year vs. this-year sales and averages, stock aging, recall counts, purchase/sale prices, and margins.
## Sales.ToorVisit

- **Kind:** table
- **Description:** Visit tour planning per year/month/weekday: day status, tour, priority, and daily target multiplier.
## Sales.TopProductTarget

- **Kind:** table
- **Description:** Monthly top-product sales targets by year, month, region, distribution center, supplier, salesperson and product, holding quantity and value targets plus Shamsi/Miladi dates.
## Sales.TopSupplierTarget

- **Kind:** table
- **Description:** Monthly top-supplier targets by region, distribution center, supplier and salesperson, with the target value and date columns.
## Sales.TotalGLN

- **Kind:** table
- **Description:** Customer GLN (Global Location Number) registry: customer name, national code, postal code, GLN, province, city and telephone.
## Sales.ToziNavgan

- **Kind:** table
- **Description:** Distribution fleet master: vehicle/asset code, license plate, ownership type, driver, brand, type, net and gross weight limits, cargo dimensions, axles/wheels, refrigeration, fuel type, build year, service dates, status and notes.
## Sales.ToziNavganAsnad

- **Kind:** table
- **Description:** Document and attachment records linked to a fleet entry: file paths, description, web address and entering user.
## Sales.ToziNavganBarbary

- **Kind:** table
- **Description:** Secondary fleet register keyed by vehicle and distribution center, holding machine number, driver, notes and entering user.
## Sales.ToziNavganBarbarySatr

- **Kind:** table
- **Description:** Line-level rows for the secondary fleet register, repeating vehicle specifications (ownership, brand, dimensions, axles, refrigeration, service dates) per center and driver.
## Sales.ToziNavganKol

- **Kind:** table
- **Description:** Small classification table mapping a fleet entry to a type/category code.
## Sales.ToziNavganPaymani

- **Kind:** table
- **Description:** Contractual (paymani) fleet register: license plate plus the full vehicle specification set, status, notes and entering user.
## Sales.ToziNavganPaymaniSatr

- **Kind:** table
- **Description:** Line-level rows for contractual fleet entries, repeating vehicle specifications per center, driver and machine.
## Sales.ToziNavganSatr

- **Kind:** table
- **Description:** Line-level rows for the main fleet table, repeating vehicle specifications per distribution center, driver and machine number.
## Sales.ToziVosolAdamTahvil

- **Kind:** table
- **Description:** Failed-delivery (non-receipt) log for an invoice request, with comments, staff code, entry date and year.
## Sales.VPorseshNameSatr

- **Kind:** view
- **Description:** View of questionnaire line items joined to their header: questionnaire code/name, registration date, description, linked invoices and row number.
## Sales.View_kholaseAmalkarMarakez8

- **Kind:** view
- **Description:** Performance summary by distribution center comparing this month's count with last month's.
## Sales.View_kholaseAmalkard7

- **Kind:** view
- **Description:** Performance summary by distribution center and sales group with counts.
## Sales.View_kholaseAmalkardMarakez6

- **Kind:** view
- **Description:** Performance summary by distribution center and group comparing current-month vs previous-month counts.
## Sales.ZarfiatVazniMojazBarGiri

- **Kind:** table
- **Description:** Lookup of allowed gross (permitted pickup) weight capacity values.
## Sales.ZarfiatVazniNakhales

- **Kind:** table
- **Description:** Lookup of net payload weight capacity values.
## Sales.ZaribForoshandeh

- **Kind:** table
- **Description:** Monthly salesperson coefficient by year, month, distribution center and salesperson, used in target/bonus calculations.
## Sales.ZaribMoshtaryTaminkonandeh

- **Kind:** table
- **Description:** Monthly customer-supplier coefficient by center, supplier, salesperson and customer (including the new customer code).
## Sales.ZaribRisk

- **Kind:** table
- **Description:** Risk-coefficient bands mapping reopened-invoice amount and count ranges to a risk multiplier.
## Sales.sherkatPakhsh

- **Kind:** table
- **Description:** Distribution company accounts with name, login username, password, token, code and last-login timestamp.
## Sales.tmpReportEtebarMoshtary

- **Kind:** table
- **Description:** Session-scoped temporary customer credit report: proposed and current credit, invoice count, sales amount, visit cycle, delivery duration, customer group, referral date and center.
## Sales.tmpReportHadaf

- **Kind:** table
- **Description:** Session-scoped temporary sales-target report comparing actual vs target sales (rial and quantity) by day, month-to-date, month and period across region, center, sales group, salesperson, supplier and product.
## Sales.tmpReportJaizehForosh

- **Kind:** table
- **Description:** Session-scoped temporary sales-prize report: sales vs target, prize-covered rial amount, total score, prize value and benefits per staff member and center.
## Sales.tmpReportJaizehForoshEmtiaz

- **Kind:** table
- **Description:** Session-scoped temporary breakdown of the scoring criteria (action title, value, operator, base, score, type) behind sales prizes.
## Sales.tmpReportJaizehForoshKala

- **Kind:** table
- **Description:** Session-scoped temporary report of sales vs target, achievement percent and prize-covered amount per product and supplier.
## Sales.tmp_TakhfifatRialiBeOhdehTaminKonandeh

- **Kind:** table
- **Description:** Session-scoped temporary report of rial discounts charged to the supplier's account, per invoice, document, product, customer and center.
## Sales.vAdamDarkhast

- **Kind:** view
- **Description:** View of no-order (non-request) customer visits: entry type, region, center, salesperson, customer, city, visit date and time of follow-up.
## Sales.vAdamDarkhastSatr

- **Kind:** view
- **Description:** Line-level no-order visit view adding status, status text, reason and reason name to the header data.
## Sales.vAfradRanandeh

- **Kind:** view
- **Description:** View of drivers with their distribution center, vehicle, vehicle type, dimensions, weight, ownership type and license plate.
## Sales.vBranchShare

- **Kind:** view
- **Description:** Monthly supplier market share by distribution branch, supplier and region.
## Sales.vChanelShareMarkazPakhsh

- **Kind:** view
- **Description:** Monthly distribution center share by sales channel.
## Sales.vChanelShareProduct

- **Kind:** view
- **Description:** Monthly product share by sales channel and supplier.
## Sales.vChanelShareSupplier

- **Kind:** view
- **Description:** Monthly supplier share by sales channel.
## Sales.vChangeKalaGheymatForosh

- **Kind:** view
- **Description:** View of product selling-price changes: amount, validity dates, status, reason and automatic-pricing flag.
## Sales.vDarkhastFaktor

- **Kind:** view
- **Description:** Order/invoice request header view: entry type, region, center, salesperson, customer, delivery address, current credit, request and invoice numbers with dates.
## Sales.vDarkhastFaktorAllVazeiat

- **Kind:** view
- **Description:** Full status history of order/invoice requests with status code, date and time.
## Sales.vDarkhastFaktorCRM

- **Kind:** view
- **Description:** CRM-oriented copy of the order/invoice request header view with customer, address and invoice details.
## Sales.vDarkhastFaktorEstemhal

- **Kind:** view
- **Description:** Delayed-delivery exemption/permit view for an invoice request: delay days, initial delivery duration, permit number/date/issuer, responsible party, supplier and linked invoice details.
## Sales.vDarkhastFaktorSatr

- **Kind:** view
- **Description:** Order/invoice request line items with product, batch number, production/expiry dates and item dimensions/volume.
## Sales.vDarkhastFaktorSatrTakhfif

- **Kind:** view
- **Description:** Discounts attached to invoice request lines: discount type, percent and amount for the given year.
## Sales.vDarkhastFaktorTaavoni

- **Kind:** view
- **Description:** Cooperative (shared) order view: center, salesperson, customer, invoice number/date, entry date and net invoice amount.
## Sales.vDarkhastFaktorTaavoniSatr

- **Kind:** view
- **Description:** Person-level lines of cooperative orders with entry type, collection method, collection duration, status, reason, entry date and net amount per person.
## Sales.vDarkhastFaktorTaavoniSatrKala

- **Kind:** view
- **Description:** Product-level lines of cooperative orders: product, supplier, batch, production/expiry dates, quantities, sales amount, discount percent and average price.
## Sales.vDarkhastFaktorTakhfif

- **Kind:** view
- **Description:** Header-level discounts for invoice requests: discount type, percent and amount, collection period and delivery type.
## Sales.vDarkhastFaktorTitrSatr

- **Kind:** view
- **Description:** Compact header+line view of invoice requests: center, salesperson, invoice, product, quantity, sales amount and total for a year.
## Sales.vDarkhastFaktorVazeiat

- **Kind:** view
- **Description:** Status codes and status dates recorded for invoice requests, per year.
## Sales.vElamMarjoee

- **Kind:** view
- **Description:** Return-declaration (marjoee) header view: entry type, region, center, salesperson, customer, declaration number/date, status, reason and linked invoice request.
## Sales.vElamMarjoeeSatr

- **Kind:** view
- **Description:** Line items of return declarations: product, batch, production/expiry dates, quantities, fee, return reason and return type.
## Sales.vElatAdamForoshMarkazPakhsh

- **Kind:** view
- **Description:** Lookup of reasons for no sales at a distribution center.
## Sales.vEtebarMojazAeenNameh

- **Kind:** view
- **Description:** Credit limits allowed by official letter, per customer group: rial and quantity caps, validity dates/times, status and reason.
## Sales.vEtebarMojazAeenNamehHistory

- **Kind:** view
- **Description:** History of official-letter credit limits (same structure as the current view, past records).
## Sales.vForoshandeh

- **Kind:** view
- **Description:** Salesperson master view: center, sales group, supervisor, type, allowed days, bounced-check limits, reopened-invoice limits, status, contact details and device ID.
## Sales.vForoshandehBeForoshandeh

- **Kind:** view
- **Description:** Salesperson-to-salesperson assignment/coverage with validity dates.
## Sales.vForoshandehKalaSahmiehBandy

- **Kind:** view
- **Description:** Per-salesperson product quota allocation: share ratio, stock quantity, validity window, status and reason.
## Sales.vForoshandehKalaSahmiehBandyHistory

- **Kind:** view
- **Description:** History of per-salesperson product quota allocations.
## Sales.vForoshandehMoshtary

- **Kind:** view
- **Description:** Salesperson-customer assignment with route, tour duration, visit day, priority, status, credit-block flags and customer status.
## Sales.vForoshandehNoeMoshtary

- **Kind:** view
- **Description:** Salesperson-to-customer-group assignments with validity window, status and reason.
## Sales.vForoshandehNoeMoshtaryHistory

- **Kind:** view
- **Description:** History of salesperson-to-customer-group assignments.
## Sales.vGorohForosh

- **Kind:** view
- **Description:** Sales group lookup: distribution center, group code/description, supervisor and status.
## Sales.vGorohOlaviatTozih

- **Kind:** view
- **Description:** Priority (olaviat) explanations mapped to a group, its linked group and root group.
## Sales.vHadafForoshandeh

- **Kind:** view
- **Description:** Salesperson targets expressed as percentages of the center and monthly targets, with computed rial amounts by year and month.
## Sales.vHadafForoshandeh_DP

- **Kind:** view
- **Description:** Dashboard version of salesperson targets adding person name, month name, annual target amount and version.
## Sales.vHadafMah_DP

- **Kind:** view
- **Description:** Dashboard monthly-target breakdown: annual target amount, monthly percent and amount by year and version.
## Sales.vHadafPelekaniHistory

- **Kind:** view
- **Description:** Historical palletized-product targets (Hadaf1-8) by year, month, product and distribution center, with Shamsi dates and version.
## Sales.vHadafSalForoshandeh_DP

- **Kind:** view
- **Description:** Dashboard annual salesperson targets: monthly and annual target amounts by center, month and version.
## Sales.vHadafSalKala

- **Kind:** view
- **Description:** Annual product targets by distribution center with monthly share percentages and monthly target quantity.
## Sales.vHadafSalMarkazPakhsh_DP

- **Kind:** view
- **Description:** Dashboard annual distribution-center targets with monthly amounts and version.
## Sales.vHadafSalMoshtary_DP

- **Kind:** view
- **Description:** Dashboard annual customer targets with monthly amounts and version.
## Sales.vJayezeh

- **Kind:** view
- **Description:** Prize/promotion definitions targeted at a customer or customer group: validity, quantity-vs-rial type and one-time-use flag.
## Sales.vJayezehAndJayezehSatr

- **Kind:** view
- **Description:** Prize definitions joined with their line-item (field) details.
## Sales.vJayezehBach

- **Kind:** view
- **Description:** Batch-based prize rules: eligible product/brand/group/supplier/basket, quantity ranges and bundles, prize quantity and prize amount.
## Sales.vJayezehBachBlockHistory

- **Kind:** view
- **Description:** History of blocked batch-prize definitions with validity dates and supplier.
## Sales.vJayezehBachHistory

- **Kind:** view
- **Description:** History of batch-prize definitions: type, description, validity dates and supplier.
## Sales.vJayezehBachSatr

- **Kind:** view
- **Description:** Line detail of batch prizes: eligible product, quantity ranges and bundles, prize quantity/amount/product and batch production/expiry dates.
## Sales.vJayezehBachSatrBlock

- **Kind:** view
- **Description:** Blocked lines of batch prizes with quantity ranges, month ranges, expiry ranges and prize type.
## Sales.vJayezehBachVijeh

- **Kind:** view
- **Description:** Special batch prizes for a distribution center: main product batch and expiry versus prize product batch and prize quantity.
## Sales.vJayezehHistory

- **Kind:** view
- **Description:** History of prize/promotion definitions.
## Sales.vJayezehSatr

- **Kind:** view
- **Description:** Line detail of prize definitions: eligible product, brand, group, supplier and baskets, quantity ranges and prize quantity/amount.
## Sales.vJayezehSatrKala

- **Kind:** view
- **Description:** Prize line items with prize percent, quantity, rial amount and prize product code.
## Sales.vKalaAdamForoshForoshandeh

- **Kind:** view
- **Description:** Per-salesperson product no-sale (banned) windows with brochure reference, validity, status and reason.
## Sales.vKalaAdamForoshForoshandehHistory

- **Kind:** view
- **Description:** History of per-salesperson product no-sale windows.
## Sales.vKalaAdamForoshGorohiVahedKharid

- **Kind:** view
- **Description:** Group-level product no-sale restrictions per purchase unit/customer type, with center, supplier, customer link and validity.
## Sales.vKalaAdamForoshGorohiVahedKharidNew

- **Kind:** view
- **Description:** Updated variant of the group-level product no-sale restriction view.
## Sales.vKalaAdamForoshInMarkazPakhsh

- **Kind:** view
- **Description:** Product no-sale (banned) records within a distribution center: validity window, status, reason and customer link.
## Sales.vKalaAdamForoshInMarkazPakhshHistory

- **Kind:** view
- **Description:** History of product no-sale records within distribution centers.
## Sales.vKalaAdamForoshMarkazPakhsh

- **Kind:** view
- **Description:** Products blocked from sale at a distribution center, with validity, status, reason and customer type.
## Sales.vKalaAdamForoshMarkazPakhshHistory

- **Kind:** view
- **Description:** History of products blocked from sale at distribution centers, including the closing date.
## Sales.vKalaAdamForoshShahr

- **Kind:** view
- **Description:** City-level product no-sale restrictions with validity, status and reason.
## Sales.vKalaAdamForoshShahrHistory

- **Kind:** view
- **Description:** History of city-level product no-sale restrictions.
## Sales.vKalaAdamMarjoeeMarkazPakhsh

- **Kind:** view
- **Description:** Products declared non-returnable at a distribution center, with validity, status and reason.
## Sales.vKalaAdamMarjoeeMarkazPakhshHistory

- **Kind:** view
- **Description:** History of non-returnable product declarations per center, including the closing date.
## Sales.vKalaBazPardakht

- **Kind:** view
- **Description:** Product repayment/deferment records by year: quantity, price, repayment period, receipt, base and due dates, status, reason and audit users.
## Sales.vKalaGheymatForosh

- **Kind:** view
- **Description:** Current product selling prices with validity dates, status, reason and automatic-pricing flag.
## Sales.vKalaGheymatForoshHistory

- **Kind:** view
- **Description:** History of product selling prices with change and reversal reasons, attached file and automatic-status flag.
## Sales.vKalaGheymatForoshHistoryWithoutOrder

- **Kind:** view
- **Description:** Unordered variant of the product selling-price history view.
## Sales.vKalaGorohiAdamForoshMarkazPakhsh

- **Kind:** view
- **Description:** Group-level product no-sale restrictions at a distribution center, with validity, status, reason and customer link.
## Sales.vKalaModatBazPardakhtFaal

- **Kind:** view
- **Description:** Active product collection-period (deferred payment) definitions, showing each item's validity window (From/End date) and enabled flag.
## Sales.vKalaModatVosolCheck

- **Kind:** view
- **Description:** Current check-based collection-period rules per item, distribution center and group, with validity window, status, reason and credit collection term.
## Sales.vKalaModatVosolCheckHistory

- **Kind:** view
- **Description:** Audit history of the check-based item collection-period rules, mirroring the current view with status, reason and group details.
## Sales.vKalaModatVosolCheck_Full

- **Kind:** view
- **Description:** Full check-based item collection periods including the from/to range and check type code (CodeNo/CodeHamsan).
## Sales.vKalaModatVosolCheck_Simple

- **Kind:** view
- **Description:** Minimal check-based item collection periods: item code and collection term only.
## Sales.vKalaZaribForosh

- **Kind:** view
- **Description:** Active sales-coefficient rules per item and packaging type, with validity window, sales group, status and reason.
## Sales.vKalaZaribForoshHistory

- **Kind:** view
- **Description:** Audit history of sales-coefficient (ZaribForosh) rules with item, group, validity window and status.
## Sales.vMashin

- **Kind:** view
- **Description:** Vehicle master for a distribution center: vehicle type, dimensions, weight, plate number, ownership type and assigned driver.
## Sales.vMasir

- **Kind:** view
- **Description:** Delivery route (Masir) definitions with visit tour, start date, selling days allowed, seller, status and priority.
## Sales.vMasirHamsan

- **Kind:** view
- **Description:** Equivalent/backup route definitions with full geography hierarchy (province to locality), route type, priority, distance and dispatch time.
## Sales.vMasirHamsanSatr

- **Kind:** view
- **Description:** Stop lines of equivalent routes: each locality (village up to province) on a route with its priority.
## Sales.vMasirSatr

- **Kind:** view
- **Description:** Stop lines of delivery routes: route header info joined with the locality hierarchy of each stop.
## Sales.vMojavezEstemhal

- **Kind:** view
- **Description:** Delay/deferral permission documents for invoice requests: permit number, delay days, status, approval type, request/invoice dates and amounts.
## Sales.vMoshtary

- **Kind:** view
- **Description:** Customer master view: customer name and codes, linked/referred customers, introduction date, collection method, personality type, geography and economic/postal codes.
## Sales.vMoshtaryAddress

- **Kind:** view
- **Description:** Customer addresses with address type, full geography hierarchy, phone, status and old/new customer codes.
## Sales.vMoshtaryAddressSaatTahvil

- **Kind:** view
- **Description:** Allowed delivery time windows (from/to hour) for each customer address.
## Sales.vMoshtaryAfrad

- **Kind:** view
- **Description:** Customer contacts/persons: full name, position, signature authority, national code/ID, email, phone and status.
## Sales.vMoshtaryAfradForPrintFaktor

- **Kind:** view
- **Description:** Minimal customer contact data (full name, national code/ID) used when printing invoices.
## Sales.vMoshtaryCRM

- **Kind:** view
- **Description:** CRM customer profile: distribution center, contact/address details, GLN/HIX codes and sector flags (hospital, dental, university, etc.).
## Sales.vMoshtaryEtebar

- **Kind:** view
- **Description:** Current customer credit limits: current credit, min/max and count-based credit, credit level, requested amounts, status, reason and validity window.
## Sales.vMoshtaryEtebarHistory

- **Kind:** view
- **Description:** Historical customer credit-limit records with credit level, status, reason and sales-group description.
## Sales.vMoshtaryGoroh

- **Kind:** view
- **Description:** Customer-to-group memberships with group hierarchy (root/parent/child), link group, distribution center and status.
## Sales.vMoshtaryJadid

- **Kind:** view
- **Description:** New-customer registration/prospect view: group, proposed credit, initial address/phone, referring person, seller, ownership type, license durations and geography.
## Sales.vMoshtaryPhoto

- **Kind:** view
- **Description:** Customer photos with photo type, thumbnail and full-size image data and file names.
## Sales.vMoshtaryShomarehHesab

- **Kind:** view
- **Description:** Customer bank accounts: account number, bank/branch, account type, active flag, holder name, city, check type and validity date.
## Sales.vMoshtaryShomarehHesabWithSheba

- **Kind:** view
- **Description:** Customer bank accounts including the IBAN (Sheba) number, plus bank/branch, active flag and holder details.
## Sales.vMoshtaryVaziatLast

- **Kind:** view
- **Description:** Most recent status record per customer: status code, notes, user, entry time, message-sent flag and row rank.
## Sales.vMoshtaryWebsite

- **Kind:** view
- **Description:** Website-facing customer directory: branch, customer name/contacts, GLN/HIX, national and economic codes, block status and status code.
## Sales.vMoshtaryWithCodeMarkazPakhsh

- **Kind:** view
- **Description:** Customers joined with distribution-center old/new codes plus license details (kart, javaz, permit number/expiry, vehicle type, degree).
## Sales.vMoshtaryWithccMarkazPakhsh

- **Kind:** view
- **Description:** Customers keyed by distribution-center ID (cc) with license/permit details and crate (Ghafaseh) and refrigerator counts.
## Sales.vNoeMashin

- **Kind:** view
- **Description:** Vehicle-type definitions: length/width/height and weight with their units of measure, plus calculated volume.
## Sales.vNoeMoshtaryRialKharid

- **Kind:** view
- **Description:** Rial-purchase customer type definitions per sales group, including the minimum purchase amount.
## Sales.vPoorsant

- **Kind:** view
- **Description:** Commission (Porsant) rates per item and supplier: percentage, rial flag and validity window.
## Sales.vPorseshNameNatayej

- **Kind:** view
- **Description:** Questionnaire results per customer: registration date, average/total scores, comments and preferred/compared distributor companies.
## Sales.vPrintFaktor

- **Kind:** view
- **Description:** Invoice print layout: distribution center and contact info, invoice/request dates, customer and delivery address, collection type, seller and route.
## Sales.vPrintFaktor1

- **Kind:** view
- **Description:** Invoice print layout based on the request (darkhast) document: center, request dates, customer, delivery address, collection type, seller and product fields.
## Sales.vPrintPishFaktor

- **Kind:** view
- **Description:** Proforma (pre-invoice) print layout with center, invoice/request dates, customer, delivery address, collection type and seller.
## Sales.vPrintPishFaktorAzKartabl

- **Kind:** view
- **Description:** Proforma print layout generated from the portfolio queue (kartabl), including collection period and delivery address.
## Sales.vPrintPishFaktorAzKartablA4

- **Kind:** view
- **Description:** A4-layout variant of the portfolio-queue proforma print view.
## Sales.vSabadKalasms

- **Kind:** view
- **Description:** Saved shopping-basket records: name, status, start/end dates, last-modified info and owning user.
## Sales.vSahmiehBandiTahtControlExceptions

- **Kind:** view
- **Description:** Customers excluded from under-control allocation: control ID, active flag, exception type, customer and distribution center.
## Sales.vSellerShare

- **Kind:** view
- **Description:** Seller/channel share results per year and month: distribution center, supplier, region, seller and channel share.
## Sales.vSghfeEstemhal

- **Kind:** view
- **Description:** Deferral ceiling per distribution center: total amount, daily average and validity window.
## Sales.vSghfeEstemhalHistory

- **Kind:** view
- **Description:** Historical deferral-ceiling records per distribution center with amount, daily average and validity window.
## Sales.vSharhFaktor

- **Kind:** view
- **Description:** Invoice description/footnote texts per distribution center with a validity window.
## Sales.vTafkikJoze

- **Kind:** view
- **Description:** Load-splitting (Tafkik Joze) dispatch documents: document number, planned and actual dispatch dates, vehicle type/capacity, driver and exit/entry times.
## Sales.vTafkikJozeKhodro

- **Kind:** view
- **Description:** Vehicle-level view of load-splitting dispatch documents with vehicle type/capacity, driver and exit/entry times.
## Sales.vTafkikJozeKhodroPopUp

- **Kind:** view
- **Description:** Popup variant of the vehicle load-splitting view: dispatch document, vehicle, driver and timing details.
## Sales.vTafkikJozeSatr

- **Kind:** view
- **Description:** Line items of a load-splitting document: distribution officer, seller, customer, invoice number/date/status, net amount and dispatch date.
## Sales.vTafkikKol

- **Kind:** view
- **Description:** Master load-splitting documents per distribution center with document number and date.
## Sales.vTafkikKolSatr

- **Kind:** view
- **Description:** Lines linking master load-splitting documents to per-vehicle documents, with vehicle type and driver.
## Sales.vTahtControlGroup

- **Kind:** view
- **Description:** Controlled allocation quotas per sales group/product: quantity per pack plus nightly, half-day and daily allocation counts, with active flag.
## Sales.vTakhfifHajmi

- **Kind:** view
- **Description:** Volume-discount definitions: description, validity window, quantity/rial mode, target customer/group, discount %, payment term and obligor type.
## Sales.vTakhfifHajmiHistory

- **Kind:** view
- **Description:** Historical volume-discount definitions with target customer/group, discount % and validity window.
## Sales.vTakhfifHajmiSatr

- **Kind:** view
- **Description:** Line items of a volume discount: target field, item/brand/group/supplier, from-to ranges, packaging type and discount %.
## Sales.vTakhfifHamlMostaghim

- **Kind:** view
- **Description:** Direct-freight discount definitions: vehicle type, amounts/volume/weight, discount %, supplier and validity window.
## Sales.vTakhfifHamlMostaghimHistory

- **Kind:** view
- **Description:** Historical direct-freight discount records with vehicle, amount, discount %, supplier and validity window.
## Sales.vTakhfifHamlMostaghimSatr

- **Kind:** view
- **Description:** Product lines eligible for a direct-freight discount (item code and old item code).
## Sales.vTakhfifJayezeh

- **Kind:** view
- **Description:** Gift/prize program definitions: form type, description, validity window, quantity/rial mode, vehicle amount, target customer/group and priority.
## Sales.vTakhfifJayezehAdam

- **Kind:** view
- **Description:** Exclusion (Adam) rules mapping gift programs to blocked volume, cash, freight and other discount types.
## Sales.vTakhfifJayezehCodeNoeVorodDarkhast

- **Kind:** view
- **Description:** Maps request entry types to applicable gift, volume, cash, freight and collection-facility discount codes.
## Sales.vTakhfifJayezehHistory

- **Kind:** view
- **Description:** Historical gift/prize program records with form type, target customer/group, priority and validity window.
## Sales.vTakhfifJayezehMarkazPakhsh

- **Kind:** view
- **Description:** Gift-program assignments per distribution center, mapping to volume, cash, freight and collection-facility discount codes.
## Sales.vTakhfifJayezehSatr

- **Kind:** view
- **Description:** Line items of a gift program: target field, item/brand/group, from-to ranges, packaging, gift quantity/amount/item and discount %.
## Sales.vTakhfifNaghdy

- **Kind:** view
- **Description:** Cash-discount definitions: calculation type, discount %, amount cap, target customer/group and validity window.
## Sales.vTakhfifNaghdyHistory

- **Kind:** view
- **Description:** Historical cash-discount records with calculation type, %, cap, target customer/group and validity window.
## Sales.vTakhfifSenfi

- **Kind:** view
- **Description:** Occupational-segment (senfi) discount definitions: target field, customer/group, quantity/rial mode, obligor type and validity window.
## Sales.vTakhfifSenfiAndSenfiSatr

- **Kind:** view
- **Description:** Combined header and line view of occupational-segment discounts with target field and validity window.
## Sales.vTakhfifSenfiHistory

- **Kind:** view
- **Description:** Historical occupational-segment discount records with target customer/group and validity window.
## Sales.vTakhfifSenfiSatr

- **Kind:** view
- **Description:** Line items of an occupational-segment discount: target field, item/brand/group/supplier, from-to ranges, packaging type and discount %.
## Sales.vTargetDental

- **Kind:** view
- **Description:** Monthly dental-category sales target (rial amount) per distribution center.
## Sales.vTargetExpireDate

- **Kind:** view
- **Description:** Monthly expiry-date sales targets and actuals (two target/actual pairs) per distribution center.
## Sales.vTargetKol

- **Kind:** view
- **Description:** Overall monthly sales target per supplier: rial target and TPCO figure by year/month.
## Sales.vTargetLoyalCustomer

- **Kind:** view
- **Description:** Monthly loyal-customer sales target (rial amount) per distribution center.
## Sales.vTargetNKala

- **Kind:** view
- **Description:** Monthly unit (tedad) sales target per supplier and product by year/month.
## Sales.vTargetNTaminkonandeh

- **Kind:** view
- **Description:** Monthly sales targets per supplier by year/month: rial target and TPCO figure.
## Sales.vTargetProductItem

- **Kind:** view
- **Description:** Monthly unit sales target per distribution center and product item.
## Sales.vTargetTPCO

- **Kind:** view
- **Description:** Monthly TPCO and rial sales targets per supplier by year/month.
## Sales.vTashilatModatVosolSatr

- **Kind:** view
- **Description:** Product lines of a collection-facility (deferred payment) header: item and supplier per facility record.
## Sales.vTashilatModatVosolSpecials

- **Kind:** view
- **Description:** Special collection-facility (bank/Pelekan) product lines: item and supplier per special facility record.
## Sales.vToziNavgan

- **Kind:** view
- **Description:** Distribution fleet vehicle registry: plate, asset, distribution center, driver, brand/type, load capacity, dimensions, axles/wheels, ownership and fridge flag.
## Sales.vToziNavganBarbary

- **Kind:** view
- **Description:** Distribution fleet registry (Barbary view) with plate, asset, driver, brand/type, capacities, dimensions and ownership.
## Sales.vToziNavganKol

- **Kind:** view
- **Description:** Consolidated vehicle list: type with dimensions/units, capacity, plate, driver, distribution center, ownership, notes and distribution flag.
## Sales.vToziNavganKolKhodro

- **Kind:** view
- **Description:** Simplified vehicle list: type, plate, driver, unladen capacity and distribution flag.
## Sales.vToziNavganKolKhodroAll

- **Kind:** view
- **Description:** Simplified vehicle list including all vehicles: type, plate, driver, capacity and distribution flag.
## Sales.vToziNavganPaymani

- **Kind:** view
- **Description:** Contracted (paymani) fleet vehicles: plate, asset, center, driver, brand/type, capacities, dimensions, ownership and fridge flag.
## Sales.zaribMoshtaryEtebar

- **Kind:** table
- **Description:** Credit coefficient lookup table mapping customer credit grade to a coefficient (zarib).
## dbo.ForoshandehDeviceID14011204

- **Kind:** table
- **Description:** Seller mobile-device registration table: seller, app version, IMEI and Android ID (snapshot dated 1401/12/04).
## dbo.KalaTaminkonandehForoshandeh

- **Kind:** table
- **Description:** Intended item-supplier-seller mapping, but columns (Id, albumId, title, url, thumbnailUrl) indicate placeholder/test data rather than real sales data.
## dbo.SalesReport

- **Kind:** table
- **Description:** Synchronized sales report fact table: per center/customer/item with sale/gift/return quantities and amounts, invoice number, packaging, economic code and sync metadata.
## dbo.SalesWithInventoryReport

- **Kind:** table
- **Description:** Synchronized sales-and-inventory report fact table with the same sales columns as SalesReport, used for combined sales/stock reporting.
