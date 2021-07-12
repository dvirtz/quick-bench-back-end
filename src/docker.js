const { exec } = require('./tools');
const fetch = require('node-fetch');

const toConanVersion = version => version.replace("-", "")

const getTags = async () => {
    // const token = await getToken();
    const PAGE_SIZE = process.env.CONTAINER_PAGE_SIZE | 50;
    const url = `https://hub.docker.com/v2/repositories/conanio?page_size=${PAGE_SIZE}`;
    let repos = [];
    for (let i = 1; ; i++) {
        const page = await fetch(`${url}&page=${i}`).then(res => res.json());
        repos.push(...page.results);

        if (page.results.length < PAGE_SIZE) {
            break;
        }
    }
    const filtered = repos.flatMap(result => {
        const match = result.name.match(/^(gcc|clang)(\d+)$/)
        if (match) {
            const version = Number.parseInt(match[2]);
            if (version < 30) {
                return [`${match[1]}-${version}`];
            }
        }

        return [];
    });
    return filtered.sort(sortContainers);
};

/*
 * We sort clang containers before gcc containers.
 * If both are from the same compiler, we want the highest version (numerically, not alphabetically) first.
 */
function sortContainers(c1, c2) {
    if (c1.startsWith('clang')) {
        if (c2.startsWith('clang')) {
            let v1 = Number.parseFloat(c1.substr('clang-'.length));
            let v2 = Number.parseFloat(c2.substr('clang-'.length));
            return v2 - v1;
        } else {
            return -1;
        }
    } else {
        if (c2.startsWith('gcc')) {
            let v1 = Number.parseFloat(c1.substr('gcc-'.length));
            let v2 = Number.parseFloat(c2.substr('gcc-'.length));
            return v2 - v1;
        } else {
            return 1;
        }
    }
}

function readContainersList(stdout) {
    return stdout.split('\n').filter(Boolean).sort(sortContainers);
}

function listContainers(target) {
    return new Promise((resolve, reject) => {
        return exec('./list-containers', {}, (err, stdout, stderr) => {
            if (err) {
                reject(stderr);
            } else {
                target.push(...readContainersList(stdout));
                resolve();
            }
        });
    });
}

function loadOneContainer(container) {
    return new Promise((resolve, reject) => {
        exec(`docker build --build-arg BASE_IMAGE=conanio/${toConanVersion(container)} -f conanio-dockerfile -t fredtingaud/quick-bench:${container} .`, { cwd: '/quick-bench/quick-bench-docker' }, function (err, stdout, stderr) {
            if (err) {
                reject(stderr);
            } else {
                resolve();
            }
        });
    }).then(() => startContainer(container));
}

function deleteOneContainer(container) {
    return new Promise((resolve, reject) => {
        return exec('docker rmi fredtingaud/quick-bench:' + container, {}, function (err, stdout, stderr) {
            if (err) {
                reject(stderr);
            } else {
                resolve();
            }
        });
    });
}

async function loadContainers(containersToAdd) {
    await Promise.all(containersToAdd.map(container => loadOneContainer(container)));
}

async function deleteContainers(targetList) {
    await Promise.all(targetList.map(t => deleteOneContainer(t)));
}

function startContainer(container) {
    return new Promise((resolve, reject) => {
        exec(`./start-docker ${container}`, {}, function (err, stdout, stderr) {
            if (err) {
                reject(stderr);
            } else {
                resolve();
            }
        });
    });
}

exports.listContainers = listContainers;
exports.readContainersList = readContainersList;
exports.getTags = getTags;
exports.loadContainers = loadContainers;
exports.deleteContainers = deleteContainers;
exports.startContainer = startContainer;