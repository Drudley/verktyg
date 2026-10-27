# Vendored libraries (served from this folder, no CDN)

| File | Package | Version | Licence |
|---|---|---|---|
| pdf-lib.min.js | [pdf-lib](https://github.com/Hopding/pdf-lib) (`dist/pdf-lib.min.js`, UMD global `PDFLib`) | 1.17.1 | MIT – see LICENSE-pdf-lib.md |
| pdf.min.mjs, pdf.worker.min.mjs, standard_fonts/ | [pdfjs-dist](https://github.com/mozilla/pdf.js) (`build/`, `standard_fonts/`) | 4.10.38 | Apache-2.0 – see LICENSE-pdfjs.txt (standard_fonts/: Foxit fonts under the BSD-style LICENSE_FOXIT, Liberation fonts under the SIL Open Font License, LICENSE_LIBERATION – both included in that folder) |

Both are loaded lazily, only after the user drops a file. Files are byte-identical to the npm packages (checked by `tests/run-tests.js`).
To update: `cd tests && npm i pdf-lib@x pdfjs-dist@y` and copy the same files again.
