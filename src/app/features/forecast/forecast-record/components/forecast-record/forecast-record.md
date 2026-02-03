APFS Forecast Record Roadmap (in descending importance)
1) forecast-record.ts — Orchestrator

What it owns: workflow behavior, buttons, actions, saving, transitions, edit-mode, section gates, and “what happens when user clicks stuff.”

Critical methods to know (bookmark these):

Lifecycle / boot

ngOnInit() / record load flow

loadRecord() or initFormFromRecord() (whatever you call it)

syncFormPermissions() (you should have this) → calls applyForecastRecordRolePermissions(form, profile)

Edit mode gates

isEditMode (query param ?mode=edit)

canEditRequirementsSection, canEditContractingSection, etc. (UI-level gates)

hasEditRightsFor(roleName) (role interpretation)

Primary actions

onSaveDraft() → should be “light validation” (usually)

onSaveRecord() → “heavy validation” (required-to-proceed)

onApproveAndSend() → “heavy validation” + transition behavior

onReject(), onDelete(), onUnassign(), onReassign()

Validation pipeline (this is the hotspot)

triggerValidationUI()

applyRoleRequiredValidators()

focusFirstInvalid() / logInvalidControls()

getRoleRequiredControls() (controls required-to-proceed by lane/role)

Workflow transitions

nextLaneFromAny(fromLane) (mapping logic)

performTransition(toLane) (API call / state update)

When you’re stuck: 90% of “why is this locked/required/transitioning weird” starts here.

2) forecast-record.form.ts — Truth of the form

What it owns: the reactive form shape, default values, static validators, and the real enable/disable permissions.

Critical methods/types:

Form contract

ForecastRecordFormGroup type (the authoritative list of controls)

Form creation

buildForecastRecordForm(record)

sets initial values

applies static validators (always required fields)

calls lockDownByDefault(form)

hard disables system fields (apfsNumber/workflowStatus/component)

Permissions engine (big one)

applyForecastRecordRolePermissions(form, profile)

this is the “who can type in what” source of truth

should be called from the component whenever lane/role/edit changes

Utilities

lockDownByDefault(form) (safe default disables)

setEnabled(...), hardDisable(...)

custom validators: maxWords(500)

Rule of thumb:

If you’re asking “should this field be editable?” → this file.

If you’re asking “should this be required always?” → this file.

3) forecast-record.html — Layout + bindings

What it owns: section boundaries, which controls appear where, and the UI read-only class behavior.

Critical parts to find quickly:

Section wrappers like:

sec-requirements

sec-place-of-performance

sec-contracting

Readonly gates:

[class.readonly]="isEditMode && !canEditXSection"

Form bindings:

formControlName="..."

Grid layout wrappers:

grid-2, grid-3 (this is where your squashed/overflow bugs come from)

Rule of thumb:

If you’re asking “why does this look weird / misaligned / squashed?” → here + CSS.

4) forecast-record.service.ts — Backend boundary

What it owns: API endpoints for record CRUD + transitions + assignment (depending on your setup).

Critical methods:

getById(id)

create(payload)

update(payload)

transition(id, from, to, comment?) (if you have it)

assign/unassign (if present)

Rule of thumb:

If you’re asking “why isn’t it saving / why is the payload wrong / why 401/500?” → here.

The “Two-layer truth” that stops 80% of confusion

You’ve already run into this, so here’s the anchor:

Editability

Real: applyForecastRecordRolePermissions() (form.ts)

Visual: canEditXSection + .readonly class (component + html)

Requiredness

Always required: validators in buildForecastRecordForm() (form.ts)

Required to proceed: getRoleRequiredControls() + applyRoleRequiredValidators() (component.ts)