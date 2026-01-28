BRD LIBRARY FIXER
=================

A web-based tool to fix Fusion 360 BRD files for Bantam Tools compatibility.

Live version: https://bantamfix.com


THE PROBLEM
-----------
Bantam Tools fails to render some components when a BRD file contains multiple
libraries with the same name but different URN identifiers. This commonly
happens with Fusion 360 exports.


THE SOLUTION
------------
This tool consolidates duplicate libraries into one, ensuring all components
render properly in Bantam Tools.


HOW TO USE
----------
1. Open index.html in any modern web browser
2. Drop your .brd file onto the page (or click to select)
3. Click "Download Fixed BRD File"
4. Import the fixed file into Bantam Tools

Your file never leaves your browser - all processing happens locally.


FILES
-----
index.html      - The web interface
about.html      - Explanation of the bug for end users
brd-fixer.js    - The processing logic (extensively documented)
README.txt      - This file


FOR BANTAM TOOLS ENGINEERS
--------------------------
The brd-fixer.js file contains detailed documentation explaining:

  - What the bug is
  - Why it happens
  - How to fix it (two options provided)
  - Pseudocode for the fix

The code itself serves as a working reference implementation. The comments
explain each step and how it maps to what your parser should do.

Key sections to read:
  - Step 2: How to properly identify duplicate libraries
  - Step 4: How to merge libraries correctly
  - Step 5: How to handle element references
  - "FOR BANTAM TOOLS ENGINEERS" section at the bottom


TECHNICAL DETAILS
-----------------
The EAGLE BRD format (used by Fusion 360) supports multiple libraries with
the same name, differentiated by URN attributes:

  <library name="pinhead-2">                    <!-- no URN -->
  <library name="pinhead-2" urn="urn:adsk...">  <!-- has URN -->

Elements reference their source library:

  <element library="pinhead-2" library_urn="urn:adsk..." package="1X05"/>

Bantam's parser ignores URN attributes, matching by name only. When duplicates
exist, only one library is retained, causing package lookups to fail.


LICENSE
-------
This tool is provided freely to help the Bantam Tools community.
Use it however you like.
