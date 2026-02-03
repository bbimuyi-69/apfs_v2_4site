# APFS Forecast Record — Developer Roadmap

This document is a **navigation and mental model guide** for the APFS Forecast Record feature.
Its purpose is to help you quickly identify **which file and which method** to open when something feels “off”
(editability, required fields, validation, workflow transitions, or layout).

---

## File Importance (Descending Order)

1. **`forecast-record.ts`** — Orchestrator (most important)
2. **`forecast-record.form.ts`** — Form truth + permissions
3. **`forecast-record.html`** — Layout + bindings
4. **`forecast-record.service.ts`** — API boundary

If you are unsure where to start, start at **#1**.

---

## 1️⃣ `forecast-record.ts` — Orchestrator

**What this file owns**
- Workflow behavior
- Action buttons
- Save / Approve / Reject logic
- Edit mode
- Section-level read-only state
- Validation flow
- Transition routing

This is the **decision-making brain** of the forecast record.

### Critical methods to know

#### Lifecycle / Initialization
- `ngOnInit()`
- `loadRecord()` / `initFormFromRecord()`
- `syncFormPermissions()`
  - Calls `applyForecastRecordRolePermissions(form, profile)`

#### Edit Mode + UI Gates
- `isEditMode` (typically driven by `?mode=edit`)
- `canEditRequirementsSection`
- `canEditContractingSection`
- `canEditCoordinatorSection`
- `hasEditRightsFor(roleName)`
- `normalizeRailRole()`
- `normalizeRailStatus(raw)`

> These control **UI read-only vs editable appearance**, not actual form enablement.

---

#### Primary User Actions
- `onSaveDraft()`
  - Should be **light or permissive validation**
- `onSaveRecord()`
  - Should enforce required-to-proceed fields
- `onApproveAndSend()`
  - Required validation + workflow transition
- `onReject()`
- `onDelete()`
- `onAssign()` / `onUnassign()`

---

#### Validation Pipeline (Hot Zone)
- `triggerValidationUI()`
- `applyRoleRequiredValidators()`
- `getRoleRequiredControls()`
- `focusFirstInvalid()`
- `logInvalidControls()`

> If a field is “required sometimes” or blocking Save / Approve unexpectedly, it’s here.

---

#### Workflow Transitions
- `nextLaneFromAny(fromLane)`
- `performTransition(toLane)`

---

## 2️⃣ `forecast-record.form.ts` — Form Truth & Permissions

**What this file owns**
- The **shape of the form**
- Default values
- Always-required validators
- Enable/disable logic (actual, real permissions)

This is the **single source of truth** for what fields exist and whether they can be edited.

---

### Critical elements

#### Form Contract
```ts
export type ForecastRecordFormGroup = FormGroup<{ ... }>


//buildForecastRecordForm(record)
Responsibilities:

Creates all FormControls

Sets default values

Applies always-required validators

Calls lockDownByDefault(form)

Hard-disables system fields:

apfsNumber

workflowStatus

component


//applyForecastRecordRolePermissions(form, profile)
Responsibilities:

Enables/disables controls based on:

role

workflow lane

This is where actual typing ability is decided

If a field looks editable but you can’t type, or vice versa — check here.

//Utilities

lockDownByDefault(form)

setEnabled(control, boolean)

hardDisable(control)

Custom validators:

maxWords(500)

//Key Rule (Memorize This)
Question	Answer lives in
Does the field exist?	ForecastRecordFormGroup
Is it always required?	FormControl validators
Can user type?	applyForecastRecordRolePermissions()
Is it required only for Save / Approve?	getRoleRequiredControls()

//3️⃣ forecast-record.html — Layout & Bindings

What this file owns

Section layout

Grid alignment

Read-only styling

Form bindings

This file controls how things look, not how they behave.

//Critical areas
Section Wrappers

#sec-requirements

#sec-place-of-performance

#sec-small-business

#sec-contracting

UI Read-only Gates

//<section class="sec" [class.readonly]="isEditMode && !canEditXSection">
This affects:

visual state

pointer events

user perception

This does NOT disable the form controls — it’s cosmetic/UX.

//formControlName="fieldName"
If Angular errors say “Cannot find control…”, the issue is in the form builder.

//Grid Layout (Common Bug Source)

grid-2 → 2 columns

grid-3 → 3 columns

Never use grid-3 unless you have 3 fields in that row.

Misuse causes:

squashed inputs

overflow outside section boundaries

misaligned rows


//4️⃣ forecast-record.service.ts — API Boundary

What this file owns

HTTP calls

Backend contract

Persistence and transitions

//Common methods

getById(id)

create(payload)

update(payload)

transition(id, from, to, comment?)

assign() / unassign()

If something saves but doesn’t persist, or transitions fail — check here.


//Validation Architecture (Critical Concept)

There are two layers of required validation.

Layer 1 — Always Required

Defined on the FormControl:

new FormControl(... validators: [Validators.required])


Examples:

Primary Contact Email

Primary Contact Phone

These are always required, regardless of role or lane.


//Layer 2 — Required to Proceed

Defined dynamically:

getRoleRequiredControls()
applyRoleRequiredValidators()


Examples:

Offices

NAICS

Dollar Range

Fiscal Year (Save Record / Approve only)

These are required only for certain actions or lanes.

//UI vs Form Truth (Most Common Confusion)
UI Read-only

Controlled by:

canEditXSection

.readonly CSS class

Purpose: visual clarity

Actual Editability

Controlled by:

applyForecastRecordRolePermissions()

Purpose: real control enable/disable

These must agree, or users will be confused.


Final Note

If something feels wrong:

Check form permissions

Then required-to-proceed

Then UI read-only state

Then layout grid

This order will save you hours.
