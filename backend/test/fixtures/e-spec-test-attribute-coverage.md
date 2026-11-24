# E-Spec Test Attribute Coverage

## Sources

- Workbook: `docs/refrence/OLAH DATA WEB.xlsx`, parsed read-only from its Office Open XML ZIP/XML parts.
- `DB_SEGMENTASI ATT FS` rows 61 and 92: `BEARING` belongs to `OPEX - BARANG TEKNIK`; `SERVICE` belongs to `OPEX - JASA`.
- `MATRIKS ATT. MAT (2)` row 8: mandatory BEARING fields are Material Description, Type/Model/Part Number, Varians, Dimension, Brand, and UoM. Row 44: mandatory SERVICE fields are Project Name, Project Description, and Timeline.
- `ATT DESC ENG (2)` rows 7-13, 29-37, 64-71, and 83-110: field descriptions and Barang/Jasa scope.
- `DESIGN FORM BRG` rows 44-110 and `DESIGN WEB` rows 29-85: required visual form fields and default-generated version/date intent.
- Current implementation: `barang.js`, `jasa.js`, `backend/src/utils/specification-draft.validation.js`, and `backend/src/repositories/specification.repository.js`.

No Jasa-specific workbook was found elsewhere in `docs`; the Jasa requirements above are in `ATT DESC ENG (2)` and `MATRIKS ATT. MAT (2)`.

## Submission Rules

`getAttributeValues` in both forms omits only `undefined`, `null`, and `""`. It submits `false`, `0`, empty arrays, and empty objects when a mapped field supplies them. In practice, the minimal flows below avoid optional controls that produce arrays/objects.

`formData` is broader than `attributeValues`:

- Barang serializes all enabled named controls, with unchecked multi-checkboxes as `[]`, unchecked single checkboxes as `false`, radios as `""`, and its derived technical/document arrays whether empty or not.
- Jasa serializes native `FormData` entries, then always adds `_attachmentFileNames`, `attachmentDocuments`, and `requiredDocuments`.
- The repository validates only codes in `attributeValues`; all `formData` is persisted as JSONB.

## Barang: BEARING

Use the master-data group row whose `sapgroupcode` is `BEARING`. The live Barang select submits that group row's database `id`; the repository resolves it and passes the verified `BEARING` code to business validation.

| Attribute code | Frontend source | Submission condition | Workbook / backend requirement | Current fixture |
|---|---|---|---|---|
| `VERSION` | `version` | Non-empty only; frontend does not establish a visible default in the audited payload builder | Workbook marks auto-generated version required | Present |
| `CREATED_DATE` | `createdDate` | Non-empty only; auto-generated date control | Workbook marks required | Present |
| `PLANT` | `plant` | Selected master-data plant ID | Backend/service required; workbook required | Present |
| `REQUESTOR` | `requestor` | Non-empty text | Backend/service required; workbook required | Present |
| `DEPARTMENT` | `department` | Selected mapped department ID | Backend requires active reference when provided; workbook required | Present |
| `MATERIAL_GROUP` | `materialGroup` | Selected group database ID | Workbook required; reference resolved by backend | Present |
| `MATERIAL_CATEGORY` | first selected category | Non-empty selected category ID | Workbook required; reference/type relationship enforced | Present |
| `REASON_TO_PROCURE` | `reason` or `reasonChoice` | Non-empty selected reason ID | Workbook required; active/type relationship enforced | Present |
| `LOCATION` | `location` | Not submitted as `attributeValues`; persisted via `formData.location` | Workbook marks Asset-only, not BEARING minimum | Missing, optional |
| `MATERIAL_DESCRIPTION` | `materialDescription` | Non-empty text | BEARING mandatory in matrix and backend | Present |
| `MATERIAL_CODE` | `materialCode` | Not submitted as `attributeValues`; persisted via `formData.materialCode` and `specifications.materialcode` | Optional in matrix | Missing, optional |
| `TYPE_MODEL_PART_NUMBER` | `partNumber` | Non-empty text | BEARING mandatory in matrix and backend | Present |
| `VARIANS` | `variant` | Non-empty text | BEARING mandatory in matrix and backend | Present |
| `DIMENSION` | derived `dimension` | Non-empty derived text | BEARING mandatory in matrix and backend | Present |
| `BRAND` | `brand` | Non-empty text | BEARING mandatory in matrix and backend | Present |
| `CATALOGUE` | `catalogue` | Non-empty only | Optional in matrix | Missing, optional |
| `UOM` | `uomOther` or `uom` | Non-empty selected value | BEARING mandatory in matrix and backend | Present |
| `PACK_SIZE` | `packSize` | Non-empty derived text | Optional in matrix | Missing, optional |
| `MATERIAL` | `material` or technical `Material` object | Non-empty only | Optional for BEARING | Missing, optional |
| `KONSENTRASI` | `concentration` or technical object | Non-empty only | Not required for BEARING | Missing, optional |
| `VISCOSITAS` | `viscosity` or technical object | Non-empty only | Not required for BEARING | Missing, optional |
| `ADDITIONAL_SERVICE` | `additionalService` | Selected value | Backend mandatory for every Barang; workbook required | Present |
| `HSE_STANDARD` | `hse` | Non-empty only | Optional | Missing, optional |
| `LICENSE_REGULATION` | `license` | Non-empty only | Optional | Missing, optional |
| `WARRANTY_AFTER_SALES` | `warranty` | Non-empty only | Optional | Missing, optional |
| `VOLTAGE` through `VISCOSITAS` technical codes | `technicalAttributes` labels | A matching technical row with non-empty value | Not required for BEARING; group-dependent for other groups | Mostly missing, optional for BEARING |
| `REQUIRED_DOCUMENTS` | derived document array | Only if array length is non-zero | Optional | Missing, optional |
| `TECHNICAL_OTHERS` | technical entries whose category is `Other` | Only if non-empty | Optional | Missing, optional |
| `UNIQUE_OTHERS` | `uniqueAttributes` | Only if non-empty | Optional | Missing, optional |

Minimum real BEARING flow: allow the application-generated version/date to remain populated; select test plant, mapped department, `OPEX - BARANG TEKNIK`, `BEARING`, and a Barang reason; provide requestor, material description, part number, variant, dimension, brand, UoM, drawing image, and additional service. Leave optional mapped controls and custom/technical/document rows empty.

## Jasa: OPEX - JASA / SERVICE

Jasa starts with group code `SERVICE`, then `saveDraftToServer` maps it to the selected master-data row ID. It similarly maps the selected `Expense Jasa` UI category to the `OPEX - JASA` category ID.

| Attribute code | Frontend source | Submission condition | Workbook / backend requirement | Current fixture |
|---|---|---|---|---|
| `VERSION` | `version` | Non-empty only | Workbook auto-generated required | Present |
| `CREATED_DATE` | `createdDate` | Non-empty only | Workbook auto-generated required | Present |
| `PLANT` | `plant` | Selected plant ID | Backend/service and workbook required | Present |
| `REQUESTOR` | `requestor` | Non-empty text | Backend/service and workbook required | Present |
| `DEPARTMENT` | `department` | Selected mapped department ID | Backend Jasa and workbook required | Present |
| `REASON_TO_PROCURE` | `reasonChoice` | Selected reason ID | Backend Jasa and reference validation | Present |
| `LOCATION` | `location` | Non-empty only | Optional | Missing, optional |
| `PROJECT_NAME` | `projectName` | Non-empty text | SERVICE mandatory in matrix and backend | Present |
| `PROJECT_DESCRIPTION` | `projectDescription` | Non-empty text | SERVICE mandatory in matrix and backend | Present |
| `TIMELINE` | `timeline` | Non-empty text | SERVICE mandatory in matrix and backend | Present |
| `TECHNICAL` | `technicalSpecification[]` | Native `FormData` produces a string or array when any row is filled | Matrix optional | Missing, optional |
| `KPI` | `kpi[]` | Native `FormData` produces a string or array when any row is filled | Matrix optional | Missing, optional |
| `ENVIRONMENT_CONDITION_RESTRICTION` | `environmentCondition` | Non-empty only | Optional scope | Missing, optional |
| `HSE_STANDARD` | `hse` | Non-empty only | Optional scope | Missing, optional |
| `LICENSE_REGULATION` | `licenseRegulation` | Non-empty only | Optional scope | Missing, optional |
| `WARRANTY_AFTER_SALES` | `warranty` | Non-empty only | Optional scope | Missing, optional |
| `ATTACHMENT_DOCUMENTS` | derived `attachmentDocuments` | Always added: empty array is submitted | Backend verifies paired type/file metadata only | Present |
| `REQUIRED_DOCUMENTS` | derived `requiredDocuments` | Always added: empty array is submitted | Optional scope | Present |
| `NOTES` | `notes` | Non-empty only | Optional scope | Missing, optional |

Minimum real SERVICE flow: allow application-generated version/date to remain populated; select test plant, mapped department, UI `Expense Jasa`, `SERVICE`, and a Jasa reason; provide requestor, project name, project description, and timeline. Leave optional scope fields and document rows empty. Empty `attachmentDocuments` and `requiredDocuments` are nevertheless sent and require both fixture attributes.

## Seed Corrections Required

1. Change Barang category `E-Spec Test Barang` to exact workbook category `OPEX - BARANG TEKNIK`; retain its BRG type relationship.
2. Keep `BEARING` under that category and keep `SERVICE` under exact `OPEX - JASA`.
3. The current fixture already contains every normalized code required for the minimum BEARING and SERVICE flows, including Jasa's always-submitted empty document arrays.
4. Do not add optional codes solely for the minimum flows. Add them only if integration scenarios populate their corresponding controls; otherwise the repository will reject unknown codes.
5. If the seed intends to support arbitrary optional UI entries, add all optional codes listed above plus the technical-code set in `barang.js` (`VOLTAGE`, `PHASE`, `POWER`, `CURRENT`, `FREQUENCY`, `TEMPERATURE`, `MATERIAL`, `CAPACITY`, `CONNECTION_TYPE`, `PRESSURE`, `FLOWRATE`, `SPEED`, `TOLERANCE`, `KONSENTRASI`, `VISCOSITAS`).

## Plant Identifier Interpretation

- `plants.id` is the primary key and is referenced by `specifications.plantid` and `idxplantsdepartments.plantid`.
- `plants.plantid` is the unique business/SAP plant code displayed to the frontend.
- The review fixture may use `7201` in both columns, but they are not interchangeable by contract. The frontend submits `plants.id`; the displayed value should be a realistic SAP-style code if desired. The current fixture's explicit `id = 7201` is valid for foreign keys, while its `plantid = 7201` is only a test business code.

## Remaining Ambiguity

The workbook marks version and created date as auto-generated/required, but the audited `getAttributeValues` functions submit them only if their controls are populated. The minimum flow assumes the page initialization fills those date/version controls. If it does not, draft persistence still succeeds because current backend business validation does not require normalized `VERSION` or `CREATED_DATE`.
