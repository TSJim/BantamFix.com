# BantamFix

**Fix missing components when importing Fusion 360 BRD files into Bantam Tools**

Live tool: **https://bantamfix.com**

---

## The Problem

When you design a PCB in Fusion 360 and import the BRD file into Bantam Tools, some components may silently disappear. No error message, no warning - they just don't render.

This typically affects pin headers (1x04, 1x05, etc.) but can impact any component.

### Why It Happens

Fusion 360 allows you to use components from multiple library sources (local libraries, Autodesk cloud libraries, team libraries). When you mix components from different sources, Fusion exports them as separate library entries in the BRD file - even if they share the same library name.

Fusion uses a URN (Uniform Resource Name) attribute to distinguish these libraries:

```xml
<library name="pinhead-2">                    <!-- local library -->
<library name="pinhead-2" urn="urn:adsk...">  <!-- cloud library -->
```

**Bantam Tools ignores the URN attribute.** When it encounters multiple libraries with the same name, it keeps only one and discards the others. Components from discarded libraries fail to render.

### Visual Example

| Before (Broken) | After (Fixed) |
|-----------------|---------------|
| ![Missing headers](repair-tool/screenshot-before.png) | ![All headers visible](repair-tool/screenshot-after.png) |

The red circles show where 4-pin and 5-pin headers should appear but don't render in Bantam Tools.

---

## The Solution

### For Users: Use BantamFix.com

1. Go to **https://bantamfix.com**
2. Drop your BRD file onto the page
3. Download the fixed file
4. Import the fixed file into Bantam Tools

Your file never leaves your browser - all processing happens locally.

### For Bantam Tools Engineers

This repository contains everything needed to understand and fix this bug:

| Document | Description |
|----------|-------------|
| [01_EXECUTIVE_SUMMARY.txt](01_EXECUTIVE_SUMMARY.txt) | 1-page overview for managers |
| [02_BUG_REPORT.txt](02_BUG_REPORT.txt) | Detailed bug report with reproduction steps |
| [03_TECHNICAL_ANALYSIS.txt](03_TECHNICAL_ANALYSIS.txt) | Deep dive into the XML format and root cause |
| [04_IMPLEMENTATION_GUIDE.txt](04_IMPLEMENTATION_GUIDE.txt) | Pseudocode and implementation guidance |

#### Reference Implementation

The `repair-tool/` directory contains a complete working implementation:

- **[brd-fixer.js](repair-tool/brd-fixer.js)** - Extensively documented source code showing exactly how to fix the parser
- **[index.html](repair-tool/index.html)** - Web interface

#### Test Files

The `test-files/` directory contains files to reproduce and verify the fix:

- **BROKEN.brd** - Original file exhibiting the bug (some headers missing)
- **FIXED.brd** - Same file after repair (all headers render)

---

## Technical Details

### Root Cause

Bantam's BRD parser indexes libraries by name only:

```
libraries["pinhead-2"] = first_library_data
libraries["pinhead-2"] = second_library_data  // Overwrites first!
```

When an element references a package from the overwritten library, the lookup fails silently.

### The Fix (Pseudocode)

```python
def load_libraries(brd_xml):
    merged_libraries = {}

    for lib_element in brd_xml.find_all('library'):
        name = lib_element.get_attribute('name')

        # Create library if we haven't seen this name before
        if name not in merged_libraries:
            merged_libraries[name] = Library(name)

        # Add all packages from this library variant
        for pkg_element in lib_element.find_all('package'):
            pkg_name = pkg_element.get_attribute('name')
            pkg_data = parse_package(pkg_element)
            merged_libraries[name].packages[pkg_name] = pkg_data

    return merged_libraries
```

The key insight: **merge same-named libraries instead of overwriting**.

### Relevant XML Structure

Elements reference their source library via `library` and `library_urn` attributes:

```xml
<element name="ROT-LL" library="pinhead-2" library_urn="urn:adsk.eagle:library:12345" package="1X05" .../>
```

When libraries are merged, the `library_urn` becomes unnecessary - packages can be found by `library` + `package` name alone.

---

## Repository Structure

```
BantamFix.com/
├── README.md                    # This file
├── COVER_LETTER.txt             # Cover letter for Bantam Tools
├── 00_READ_ME_FIRST.txt         # Quick-start guide
├── 01_EXECUTIVE_SUMMARY.txt     # 1-page overview
├── 02_BUG_REPORT.txt            # Detailed bug report
├── 03_TECHNICAL_ANALYSIS.txt    # Technical deep dive
├── 04_IMPLEMENTATION_GUIDE.txt  # Implementation pseudocode
├── repair-tool/                 # Web-based repair tool
│   ├── index.html               # Main page
│   ├── about.html               # Explanation page
│   ├── brd-fixer.js             # Core logic (documented)
│   ├── screenshot-before.png    # Before screenshot
│   └── screenshot-after.png     # After screenshot
└── test-files/                  # Test files
    ├── BROKEN.brd               # File exhibiting the bug
    ├── FIXED.brd                # File after repair
    └── *.png                    # Screenshots
```

---

## FAQ

**Q: Is this Bantam's fault or Fusion 360's fault?**

A: Bantam's. The EAGLE BRD format explicitly supports multiple libraries with the same name differentiated by URN. Fusion 360 exports valid files. Bantam's parser doesn't handle them correctly.

**Q: Why do only some components disappear?**

A: Only components from "discarded" libraries disappear. If you happen to use components from only one library source, everything works. The bug manifests when you mix sources.

**Q: Is my design data safe with BantamFix.com?**

A: Yes. All processing happens in your browser using JavaScript. Your file is never uploaded to any server. You can verify this by viewing the source code or using browser developer tools.

**Q: Will Bantam fix this?**

A: We hope so! This repository provides everything they need. In the meantime, BantamFix.com is available as a workaround.

---

## License

This tool is provided freely to help the Bantam Tools community. Use it however you like.

---

## Contact

For questions or issues, please open a GitHub issue on this repository.
