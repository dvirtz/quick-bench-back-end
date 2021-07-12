var fs = require('fs').promises
  , { exec } = require('./tools')
  , { ConanFileTextLoader } = require('./conanfile')
  ;

const CONANFILE_PATH = 'quick-bench-docker/conanfile.txt';

async function installLibraries(list) {
  const conanfile = new ConanFileTextLoader(await fs.readFile(CONANFILE_PATH, 'utf-8'));
  for (const lib of list) {
    conanfile.add_requirement(lib);
  }
  await fs.writeFile(CONANFILE_PATH, conanfile.stringify());
  await new Promise((resolve, reject) => {
      exec(`./install-libraries`, {}, function (err, stdout, stderr) {
          if (err) {
              reject(stderr);
          } else {
              resolve();
          }
      });
  });
}

exports.installLibraries = installLibraries
