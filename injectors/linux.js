const {
  mkdir, writeFile, unlink, rmdir, access
} = require('fs').promises;
const { join } = require('path');

const exists = (path) =>
  access(path)
    .then(() => true)
    .catch(() => false);

const getAppDir = async () => {
  const discordPath = join('/opt/discord-canary');

  return join(
    discordPath,
    'resources',
    'app'
  );
};

exports.inject = async () => {
  const appDir = await getAppDir();
  if (await exists(appDir)) {
    console.log('Looks like you already have an injector in place. Try uninjecting (`npm run uninject`) and try again.');
    process.exit(1);
  }

  await mkdir(appDir);

  await Promise.all([
    writeFile(
      join(appDir, 'index.js'),
      `require('${join(__dirname, '..', 'src', 'patcher.js').replace(/\\/g, '\\\\')}')`
    ),
    writeFile(
      join(appDir, 'package.json'),
      JSON.stringify({ main: 'index.js' })
    )
  ]);
};

exports.uninject = async () => {
  const appDir = await getAppDir();

  if (!(await exists(appDir))) {
    console.error('There is nothing to uninject.');
    process.exit(1);
  }

  await Promise.all([
    unlink(join(appDir, 'package.json')),
    unlink(join(appDir, 'index.js'))
  ]);

  return rmdir(appDir);
};
