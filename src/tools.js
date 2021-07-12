var fs = require('fs')
  , child_process = require('child_process')
  ;

function write(fileName, code) {
    return new Promise((resolve, reject) => {
        fs.writeFile(fileName, code, (err) => {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        });
    });
}

function read(fileName, acceptMissing) {
    return new Promise((resolve, reject) => {
        fs.readFile(fileName, 'utf8', (err, data) => {
            if (err) {
                if (acceptMissing && err.code === 'ENOENT') {
                    resolve(null);
                } else {
                    reject(err);
                }
            } else {
                resolve(data);
            }
        });
    });
}

function encodeName(id) {
    let short = Buffer.from(id, 'hex').toString('base64');
    short = short.replace(new RegExp('/', 'g'), '-').replace(new RegExp('\\+', 'g'), '_');
    return short.slice(0, -1);
}

function decodeName(short) {
    short = short.replace(new RegExp('\\-', 'g'), '/').replace(new RegExp('_', 'g'), '+ ') + '=';
    return Buffer.from(short, 'base64').toString('hex');
}

function exec(command, options, callback) {
    console.log(`executing: ${command}`);
    child_process.exec(command, options, (err, stdout, stderr) => {
        if (err) {
            console.error(`failed with ${err}`);
        } else {
            console.log(`succeeded with stdout:\n${stdout}`);
        }
        callback(err, stdout, stderr);
    });
}

exports.read = read;
exports.write =  write;
exports.encodeName =  encodeName;
exports.decodeName = decodeName;
exports.exec = exec;
