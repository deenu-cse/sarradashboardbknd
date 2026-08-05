const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');

const normalizeStoredFilePath = (filePath) => {
  if (!filePath || typeof filePath !== 'string') {
    return null;
  }

  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    try {
      const parsedUrl = new URL(filePath);
      return path.join(projectRoot, parsedUrl.pathname.replace(/^\/+/, ''));
    } catch {
      return null;
    }
  }

  if (path.isAbsolute(filePath)) {
    return filePath;
  }

  return path.join(projectRoot, filePath.replace(/^\/+/, ''));
};

const deleteStoredFile = async (filePath) => {
  if (!filePath) return;

  try {
    const absolutePath = normalizeStoredFilePath(filePath);
    if (!absolutePath) {
      console.warn(`Skipping deletion for invalid storage path: ${filePath}`);
      return;
    }

    await fs.promises.access(absolutePath);
    await fs.promises.unlink(absolutePath);
    console.log(`Deleted local file: ${absolutePath}`);
  } catch (err) {
    if (err && err.code === 'ENOENT') {
      console.warn(`Local file not found, skipping deletion: ${filePath}`);
      return;
    }

    console.error(`Failed to delete local file: ${filePath}`, err);
  }
};

module.exports = {
  deleteStoredFile,
  deleteFromCloudinary: deleteStoredFile
};
