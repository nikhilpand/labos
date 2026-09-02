# LabOS — Domain Glossary (ISO/IEC 17025)

This glossary defines standard laboratory and scientific terms used throughout **LabOS**. It is grounded in the vocabulary of **ISO/IEC 17025:2017** (General requirements for the competence of testing and calibration laboratories).

---

## 1. Core Organizational & Commercial Terms

### Customer (Client)
The external or internal entity requesting laboratory testing services. In ISO/IEC 17025, the customer has specific rights regarding contract review, statement of conformity, and confidentiality.

### Contact
A specific individual associated with a Customer (e.g., environmental compliance officer, facility manager, or billing contact) who receives notifications or reports.

### Laboratory
A defined operational unit with the personnel, equipment, and environmental controls capable of performing specific scientific test methods.

### Laboratory Site
The physical facility, building, or mobile testing unit where testing activities are physically performed. ISO/IEC 17025 requires tracking the location where testing took place.

---

## 2. Sample & Physical Item Terms

### Sample
A distinct physical portion of material (water, soil, air filter, food product, chemical) submitted to the laboratory for analysis. The sample represents a larger population or source.

### Sample Type (Matrix)
The material category of the sample (e.g., `Drinking Water`, `Groundwater`, `Agricultural Soil`, `Raw Milk`). The sample type dictates which preparation methods, preservation rules, and hold-times apply.

### Sample Item (Aliquot / Container)
A physical subdivision or container of a sample. A single water sample may arrive split into three separate bottles: one preserved with nitric acid for metals, one with sulfuric acid for nutrients, and an unpreserved container for anions.

### Accessioning
The formal process of receiving, inspecting, identifying, barcoding, and logging a sample into the laboratory system upon arrival.

### Chain of Custody (CoC)
The unbroken, chronological, and legally defensible paper or electronic record showing the custody, transfer, analysis, and disposition of a sample.

### Hold Time
The maximum allowable duration between sample collection in the field and the start of laboratory analysis, beyond which the sample degrades and results are legally/scientifically invalid.

---

## 3. Request & Catalog Terms

### Test Request (Work Order)
A formal agreement or submission document from a Customer requesting one or more tests to be performed on one or more Samples.

### Test Method (SOP)
The documented, validated scientific procedure describing how a test is executed (e.g., `EPA Method 200.8`, `ISO 11885`, `Standard Methods 4500-NO3`).

### Test
The specific instance of a Test Method assigned to a specific Sample or Aliquot.

### Test Parameter (Analyte)
The individual chemical, biological, or physical substance measured by a Test Method (e.g., `Lead`, `Nitrate-Nitrogen`, `pH`, `Turbidity`).

### Unit of Measurement (UoM)
The standardized scientific unit in which a result is quantified (e.g., `mg/L`, `µg/kg`, `pH units`, `CFU/mL`).

### Reference Range / Specification Limit
The acceptable upper and lower numerical thresholds against which results are evaluated (e.g., EPA Maximum Contaminant Level of `0.015 mg/L` for Lead).

---

## 4. Analytical & Quality Control Terms

### Analytical Batch (Run Batch)
A group of environmental or testing samples processed together with the same reagents, by the same personnel, using the same equipment, and accompanied by the same Quality Control (QC) standards. In ISO/IEC 17025, batch size typically cannot exceed 20 environmental samples.

### Quality Control (QC) Sample
A non-customer sample included in an analytical batch to verify the accuracy and precision of the test run:
* **Method Blank (MB):** Pure reagent water processed identically to verify no contamination was introduced in the lab.
* **Laboratory Control Sample (LCS / Blank Spike):** Clean matrix spiked with a known concentration to verify method recovery.
* **Matrix Spike (MS):** A customer sample spiked with a known concentration to detect matrix interferences.
* **Sample Duplicate (DUP):** Re-analyzing the same sample to measure analytical precision (Relative Percent Difference).

### Instrument
A scientific machine or piece of equipment used to generate observations or measurements (e.g., ICP-MS, GC-MS, HPLC, Analytical Balance, pH Meter).

### Instrument Run
A single automated or manual sequence of analytical injections or readings executed on an Instrument.

### Calibration
The process of establishing the relationship between an instrument's response (e.g., electrical signal, light absorbance) and known concentrations of reference standards.

---

## 5. Results & Reporting Terms

### Result
The qualitative or quantitative scientific measurement obtained for a specific Test Parameter on a specific Sample.

### Result Version
An immutable snapshot of a Result. If a calculation is corrected or an analytical run is repeated, a new Result Version is generated while preserving the previous version.

### Nonconforming Work
Any aspect of testing work that does not conform to laboratory procedures or agreed customer requirements (e.g., QC failure, broken sample container, expired reagent).

### Technical Review
Verification by a qualified peer or senior analyst confirming that calibration was valid, QC standards passed, calculation math is correct, and instrument parameters were within tolerance.

### Authorization (Sign-off)
The formal approval by a legally designated reporting officer or laboratory director certifying that the results meet all requirements of ISO/IEC 17025.

### Report (Certificate of Analysis - CoA)
The official, immutable document issued to the customer presenting the verified results, test methods, measurement uncertainty (where required), and statements of conformity.

### Report Version (Amendment)
An immutable, numbered edition of a Report. If a released report must be amended, ISO/IEC 17025 clause 7.8.8 mandates releasing a formal supplement or new version clearly identifying what was changed and why.

### Audit Event
A tamper-evident, append-only historical record capturing Who, What, When, Where, and Why an action occurred within the system.
