const { cloudinary } = require('../middleware/uploadMiddleware');

// Helper: extract Cloudinary public_id from a URL
const extractPublicId = (url) => {
  if (!url) return null;
  try {
    const parts = url.split('/upload/');
    if (parts.length < 2) return null;
    const afterUpload = parts[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, '');
    const publicId = withoutVersion.replace(/\.[^/.]+$/, '');
    return publicId;
  } catch {
    return null;
  }
};

// Helper: delete a file from Cloudinary
const deleteFromCloudinary = async (url, resourceType = 'image') => {
  if (!url) return false;
  const publicId = extractPublicId(url);
  if (!publicId) return false;
  
  try {
    // Note: PDF files are usually uploaded with resource_type: 'raw'
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`Deleted Cloudinary asset: ${publicId} (${resourceType}), result:`, result);
    return true;
  } catch (err) {
    console.error(`Failed to delete Cloudinary asset: ${publicId}`, err);
    return false;
  }
};

module.exports = {
  extractPublicId,
  deleteFromCloudinary
};
