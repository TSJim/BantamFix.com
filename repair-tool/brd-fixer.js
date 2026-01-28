/**
 * =============================================================================
 * BRD LIBRARY FIXER - Reference Implementation
 * =============================================================================
 *
 * This code fixes a bug in Bantam Tools' BRD file parser where components
 * fail to render when the BRD file contains multiple libraries with the
 * same name but different URN identifiers.
 *
 * INTENDED AUDIENCE:
 *   - Users who need to fix their BRD files for Bantam Tools
 *   - Bantam Tools engineers who need to fix their parser
 *
 * THE BUG:
 *   Bantam Tools ignores the 'urn' attribute on <library> elements and the
 *   'library_urn' attribute on <element> elements. When multiple libraries
 *   share the same name, only one is retained, causing package lookups to
 *   fail for components defined in the discarded libraries.
 *
 * THE FIX:
 *   This code consolidates all libraries with the same name into a single
 *   library containing all packages from all variants. It also removes
 *   library_urn attributes from elements since they're no longer needed
 *   after consolidation.
 *
 * =============================================================================
 */


/**
 * Main entry point - fixes a BRD file content string.
 *
 * @param {string} brdContent - The raw XML content of the BRD file
 * @returns {Object} Result object containing:
 *   - fixedContent: The corrected BRD file content
 *   - originalLibraryCount: Number of libraries before consolidation
 *   - finalLibraryCount: Number of libraries after consolidation
 *   - librariesMerged: Number of duplicate library groups that were merged
 *   - elementsUpdated: Number of elements whose library_urn was removed
 *   - totalPackages: Total number of unique packages preserved
 *   - log: Array of human-readable log messages describing changes
 */
function fixBrdFile(brdContent) {
    const log = [];
    log.push('=== BRD Library Fixer - Processing Log ===\n');

    // -------------------------------------------------------------------------
    // STEP 1: Parse the XML
    // -------------------------------------------------------------------------
    // BRD files are XML format. We parse them into a DOM for manipulation.
    // -------------------------------------------------------------------------

    const parser = new DOMParser();
    const doc = parser.parseFromString(brdContent, 'application/xml');

    // Check for XML parsing errors
    const parseError = doc.querySelector('parsererror');
    if (parseError) {
        throw new Error('Invalid XML in BRD file: ' + parseError.textContent);
    }

    log.push('Step 1: Parsed XML successfully\n');


    // -------------------------------------------------------------------------
    // STEP 2: Find all libraries and group by name
    // -------------------------------------------------------------------------
    // Libraries can appear multiple times with the same 'name' attribute but
    // different 'urn' attributes. We need to find these duplicates.
    //
    // Example of duplicate libraries in a BRD file:
    //
    //   <library name="pinhead-2">                           <!-- No URN -->
    //     <packages>
    //       <package name="1X02">...</package>
    //     </packages>
    //   </library>
    //
    //   <library name="pinhead-2" urn="urn:adsk...ABC">      <!-- Has URN -->
    //     <packages>
    //       <package name="1X05">...</package>
    //     </packages>
    //   </library>
    //
    // Bantam's bug: It only keeps ONE of these, losing packages from the other.
    // -------------------------------------------------------------------------

    const libraries = doc.querySelectorAll('library');
    const libraryGroups = new Map();  // Map<libraryName, Array<libraryElement>>

    log.push('Step 2: Analyzing libraries...');
    log.push(`  Found ${libraries.length} total library definitions\n`);

    libraries.forEach(lib => {
        const name = lib.getAttribute('name');
        const urn = lib.getAttribute('urn') || '(none)';

        if (!libraryGroups.has(name)) {
            libraryGroups.set(name, []);
        }
        libraryGroups.get(name).push(lib);

        log.push(`  - "${name}" [URN: ${urn}]`);
    });

    log.push('');


    // -------------------------------------------------------------------------
    // STEP 3: Identify which library groups need consolidation
    // -------------------------------------------------------------------------
    // A library group needs consolidation if it has more than one library
    // with the same name (regardless of URN differences).
    // -------------------------------------------------------------------------

    const groupsToMerge = [];

    libraryGroups.forEach((libs, name) => {
        if (libs.length > 1) {
            groupsToMerge.push({ name, libraries: libs });
            log.push(`Step 3: Library "${name}" has ${libs.length} variants - NEEDS CONSOLIDATION`);
        }
    });

    if (groupsToMerge.length === 0) {
        log.push('Step 3: No duplicate library names found - no consolidation needed');
        return {
            fixedContent: brdContent,
            originalLibraryCount: libraries.length,
            finalLibraryCount: libraries.length,
            librariesMerged: 0,
            elementsUpdated: 0,
            totalPackages: countAllPackages(doc),
            log: log
        };
    }

    log.push('');


    // -------------------------------------------------------------------------
    // STEP 4: Merge duplicate libraries
    // -------------------------------------------------------------------------
    // For each group of same-named libraries:
    //   1. Collect all packages from all variants
    //   2. Keep the first library element, remove the others
    //   3. Add all collected packages to the kept library
    //   4. Remove any 'urn' attribute from the kept library
    //
    // This ensures Bantam Tools sees a single library with all packages.
    // -------------------------------------------------------------------------

    let totalPackagesMerged = 0;

    groupsToMerge.forEach(group => {
        log.push(`Step 4: Merging "${group.name}" libraries...`);

        // Collect all packages from all library variants
        // We use a Map to handle potential duplicate package names
        // (later definitions override earlier ones, matching typical behavior)
        const allPackages = new Map();  // Map<packageName, packageElement>

        group.libraries.forEach((lib, index) => {
            const urn = lib.getAttribute('urn') || '(none)';
            const packages = lib.querySelectorAll('packages > package');

            log.push(`  Variant ${index + 1} [URN: ${urn}]: ${packages.length} package(s)`);

            packages.forEach(pkg => {
                const pkgName = pkg.getAttribute('name');
                allPackages.set(pkgName, pkg.cloneNode(true));
                log.push(`    - ${pkgName}`);
            });
        });

        log.push(`  Total unique packages: ${allPackages.size}`);
        totalPackagesMerged += allPackages.size;

        // Keep the first library, remove its URN attribute
        const keepLib = group.libraries[0];
        keepLib.removeAttribute('urn');

        // Clear existing packages and add all collected packages
        let packagesContainer = keepLib.querySelector('packages');
        if (!packagesContainer) {
            packagesContainer = doc.createElement('packages');
            keepLib.appendChild(packagesContainer);
        }

        // Remove existing packages
        while (packagesContainer.firstChild) {
            packagesContainer.removeChild(packagesContainer.firstChild);
        }

        // Add all merged packages
        allPackages.forEach(pkg => {
            packagesContainer.appendChild(pkg);
        });

        // Remove the other library variants from the DOM
        for (let i = 1; i < group.libraries.length; i++) {
            const libToRemove = group.libraries[i];
            libToRemove.parentNode.removeChild(libToRemove);
            log.push(`  Removed duplicate library variant ${i + 1}`);
        }

        log.push('');
    });


    // -------------------------------------------------------------------------
    // STEP 5: Update element references
    // -------------------------------------------------------------------------
    // Elements reference libraries using two attributes:
    //   - library: The library name (always present)
    //   - library_urn: The specific library URN (optional)
    //
    // Example:
    //   <element name="J1" library="pinhead-2" library_urn="urn:adsk..." package="1X05"/>
    //
    // Since we've consolidated libraries, we need to remove the library_urn
    // attribute - there's now only one library with each name.
    //
    // IMPORTANT: This is the key step Bantam Tools is missing. Their parser
    // should either:
    //   A) Properly resolve library_urn to find the correct library, OR
    //   B) Merge libraries like we do here and remove the need for library_urn
    // -------------------------------------------------------------------------

    const elements = doc.querySelectorAll('element');
    let elementsUpdated = 0;

    log.push('Step 5: Updating element references...');

    elements.forEach(el => {
        const libUrn = el.getAttribute('library_urn');
        if (libUrn) {
            const elName = el.getAttribute('name');
            const libName = el.getAttribute('library');
            el.removeAttribute('library_urn');
            elementsUpdated++;
            log.push(`  ${elName}: removed library_urn (was: ${libUrn})`);
        }
    });

    if (elementsUpdated === 0) {
        log.push('  No elements had library_urn attributes');
    }

    log.push('');


    // -------------------------------------------------------------------------
    // STEP 6: Serialize back to XML string
    // -------------------------------------------------------------------------

    const serializer = new XMLSerializer();
    let fixedContent = serializer.serializeToString(doc);

    // Ensure XML declaration is present and correct
    if (!fixedContent.startsWith('<?xml')) {
        fixedContent = '<?xml version="1.0" encoding="utf-8"?>\n' + fixedContent;
    }

    log.push('Step 6: Serialized fixed BRD file');
    log.push('');
    log.push('=== Processing Complete ===');


    // -------------------------------------------------------------------------
    // Return results
    // -------------------------------------------------------------------------

    return {
        fixedContent: fixedContent,
        originalLibraryCount: libraries.length,
        finalLibraryCount: libraries.length - groupsToMerge.reduce((sum, g) => sum + g.libraries.length - 1, 0),
        librariesMerged: groupsToMerge.length,
        elementsUpdated: elementsUpdated,
        totalPackages: totalPackagesMerged,
        log: log
    };
}


/**
 * Helper function to count all packages in a document.
 *
 * @param {Document} doc - The parsed XML document
 * @returns {number} Total number of package elements
 */
function countAllPackages(doc) {
    return doc.querySelectorAll('package').length;
}


/**
 * =============================================================================
 * FOR BANTAM TOOLS ENGINEERS
 * =============================================================================
 *
 * The above code demonstrates the fix. Here's what you need to change in your
 * BRD parser:
 *
 * OPTION A: Proper URN Support (Best)
 * ------------------------------------
 * Modify your library indexing to key by (name, urn) tuple:
 *
 *   // When loading libraries:
 *   libraryIndex[(lib.name, lib.urn)] = lib  // urn may be null
 *
 *   // When resolving an element's package:
 *   key = (element.library, element.library_urn)  // library_urn may be null
 *   lib = libraryIndex[key]
 *   package = lib.packages[element.package]
 *
 *
 * OPTION B: Merge on Load (Simpler)
 * ----------------------------------
 * When loading libraries, merge same-named libraries automatically:
 *
 *   merged = {}
 *   for lib in brd.libraries:
 *       if lib.name not in merged:
 *           merged[lib.name] = new Library(lib.name)
 *       for pkg in lib.packages:
 *           merged[lib.name].packages[pkg.name] = pkg
 *
 * This is essentially what the JavaScript code above does.
 *
 *
 * TEST YOUR FIX
 * -------------
 * Use the provided test files:
 *   - "s750 SW Main PCB v1.0.3.brd" should render all components after fix
 *   - Compare behavior before/after your changes
 *
 * =============================================================================
 */
