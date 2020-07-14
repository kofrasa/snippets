import fs from 'fs'
import path from 'path'

const FROM_MODULE_RE = /from\s+(\'|\")([\.\/]+[\w\/]+)\1;$/
const IMPORT_MODULE_RE = /^import\s+(\'|\")([\.\/]+[\w\/]+)\1;$/

/**
 * Ensure all imports are resolve to a file.
 * See: https://nodejs.org/api/esm.html#esm_differences_between_es_modules_and_commonjs
 */
function fixImports(rootpath) {
  function solve(filepath) {
    let stats = fs.lstatSync(filepath)
    if (stats.isFile() && path.extname(filepath) == '.js') {
      let data = []
      fs.readFileSync(filepath).toString().split("\n").forEach(line => {
        let m = line.match(IMPORT_MODULE_RE) || line.match(FROM_MODULE_RE)
        if (m) {
          // full path to file we are analyzing
          let filepathSegments = filepath.split("/")

          // path to imported module as referred to in the file under analysis.
          // this would use a relative path from the current file
          let refpathSegments = m[2].split("/")
          let i = 0

          while (i < refpathSegments.length) {
            let name = refpathSegments[i]
            // we found a name
            if (name != '..' && name != '.') break

            // keep moving up to ancestor
            filepathSegments.pop()

            // double pop to navigate to parent, only on first run since we begin from file leaf
            if (i == 0 && name == '..') {
              filepathSegments.pop()
            }

            // navigate up the hierarchy
            i++
          }

          // create the full path to the module with '.js' file
          let modulePath = filepathSegments.concat(refpathSegments.slice(i)).join("/")

          // validate and update line if necessary.
          // we are taking length-2 for the last quote and semi-colon ==> ';
          // m[1] ==> capture string quoting
          if (fs.existsSync(modulePath + '.js')) {
            line = line.substr(0, line.length-2) + ".js" + m[1] + ";"
          } else if (fs.existsSync(modulePath + '/index.js')) {
            line = line.substr(0, line.length-2) + "/index.js" + m[1] + ";"
          }
        }

        // add line to data
        data.push(line)
      })

      // clear and rewrite file
      fs.truncateSync(filepath)
      fs.writeFileSync(filepath, data.join("\n"))

    } else if (stats.isDirectory()) {
      fs.readdirSync(filepath).forEach(leaf => solve(path.join(filepath, leaf)))
    }
  }

  console.log(`Fixing file imports in ${rootpath}`)
  solve(rootpath)
}
