# AWS S3 Migration Guide

This guide explains the migration from Cloudinary to AWS S3 for image and document storage.

## Overview

The application has been migrated from Cloudinary to AWS S3 for all file storage operations, including:
- Property images
- Unit images
- Property documents
- Blog images

## Changes Made

### Backend Changes

1. **New S3 Service** (`backend/src/services/s3Service.js`)
   - Handles file uploads to S3
   - Manages file deletions
   - Extracts S3 keys from URLs
   - Supports CloudFront CDN integration

2. **Updated Upload Service** (`backend/src/services/uploadService.js`)
   - Replaced Cloudinary storage with S3 storage
   - Updated multer middleware to use `multer-s3`
   - Modified file URL extraction to handle S3 URLs
   - Updated delete operations for S3

3. **Updated Blog Image Service** (`backend/src/services/blogImageService.js`)
   - Changed Unsplash image upload to use S3 instead of Cloudinary

4. **Dependencies**
   - Added: `@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`, `multer-s3`
   - Kept: `cloudinary` and `multer-storage-cloudinary` (can be removed if no migration needed)

### Frontend Changes

1. **Updated File Utils** (`frontend/src/utils/fileUtils.js`)
   - Added S3 URL support (`.amazonaws.com`, `cloudfront.net`)
   - Maintained backward compatibility with Cloudinary URLs

## Manual Steps Required

### 1. Create AWS Account and S3 Bucket

1. Sign up for AWS at https://aws.amazon.com if you don't have an account
2. Navigate to S3 service in AWS Console
3. Create a new S3 bucket:
   - Choose a unique bucket name (e.g., `buildstatefm-uploads`)
   - Select your preferred region (e.g., `us-east-1`)
   - **Important**: Uncheck "Block all public access" for public file access
   - Enable versioning (optional but recommended)

### 2. Configure Bucket Policy for Public Read Access

Add this bucket policy to allow public read access to your files:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

Replace `YOUR-BUCKET-NAME` with your actual bucket name.

### 3. Create IAM User for Programmatic Access

1. Navigate to IAM service in AWS Console
2. Create a new user (e.g., `buildstatefm-s3-uploader`)
3. Attach the following policy to the user:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME/*",
        "arn:aws:s3:::YOUR-BUCKET-NAME"
      ]
    }
  ]
}
```

4. Create access keys for this user
5. **IMPORTANT**: Save the Access Key ID and Secret Access Key securely

### 4. Update Environment Variables

Add the following to your `.env` file:

```bash
# AWS S3 Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id-from-step-3
AWS_SECRET_ACCESS_KEY=your-secret-access-key-from-step-3
AWS_S3_BUCKET_NAME=your-bucket-name-from-step-1

# Optional: CloudFront CDN (see step 5)
# AWS_CLOUDFRONT_DOMAIN=your-distribution-id.cloudfront.net
```

### 5. (Optional) Set Up CloudFront CDN

For better performance and lower costs:

1. Navigate to CloudFront service in AWS Console
2. Create a new distribution:
   - Origin domain: Select your S3 bucket
   - Origin access: Public
   - Viewer protocol policy: Redirect HTTP to HTTPS
   - Cache policy: CachingOptimized
3. Copy the distribution domain name (e.g., `d123456abcdef.cloudfront.net`)
4. Add to `.env`:
   ```bash
   AWS_CLOUDFRONT_DOMAIN=d123456abcdef.cloudfront.net
   ```

### 6. (Optional) Migrate Existing Cloudinary Files to S3

If you have existing files in Cloudinary that need to be migrated:

1. Create a migration script to:
   - Fetch all Cloudinary URLs from your database
   - Download each file from Cloudinary
   - Upload to S3
   - Update database records with new S3 URLs

2. Example migration query structure:
   ```sql
   -- Find all Cloudinary URLs
   SELECT id, imageUrl FROM "PropertyImage" WHERE imageUrl LIKE '%cloudinary.com%';
   SELECT id, imageUrl FROM "UnitImage" WHERE imageUrl LIKE '%cloudinary.com%';
   SELECT id, fileUrl FROM "PropertyDocument" WHERE fileUrl LIKE '%cloudinary.com%';
   ```

3. For each record:
   - Download the file
   - Upload to S3
   - Update the database record

**Note**: A migration script is not included in this implementation. You'll need to create one based on your specific data.

### 7. Test the Migration

1. Start the backend server:
   ```bash
   cd backend
   npm run dev
   ```

2. Verify S3 is configured by checking the startup logs:
   ```
   ✅ AWS S3 configured for persistent storage
      Bucket: your-bucket-name
      Region: us-east-1
   ```

3. Test file uploads:
   - Upload a property image
   - Upload a property document
   - Verify files appear in your S3 bucket
   - Verify URLs are accessible

### 8. Remove Cloudinary (Optional)

Once you've verified S3 is working and migrated all files:

1. Remove Cloudinary environment variables from `.env`
2. (Optional) Uninstall Cloudinary packages:
   ```bash
   npm uninstall cloudinary multer-storage-cloudinary
   ```

## CORS Configuration for S3

If your frontend and S3 bucket are on different domains, add CORS configuration to your bucket:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": ["https://your-frontend-domain.com"],
    "ExposeHeaders": []
  }
]
```

For development, you can use `"AllowedOrigins": ["*"]`, but restrict this in production.

## Cost Considerations

### S3 Pricing (as of 2024)
- Storage: ~$0.023 per GB/month
- PUT requests: $0.005 per 1,000 requests
- GET requests: $0.0004 per 1,000 requests
- Data transfer out: First 100GB free, then $0.09/GB

### CloudFront Pricing (optional)
- Data transfer out: $0.085/GB (first 10TB)
- Requests: $0.01 per 10,000 HTTP requests
- Free tier: 1TB data transfer out + 10M HTTP requests/month for 12 months

### Tips to Minimize Costs
1. Enable S3 Intelligent-Tiering for automatic cost optimization
2. Set lifecycle policies to delete temporary files
3. Use CloudFront to reduce S3 data transfer costs
4. Compress images before upload
5. Set proper cache headers

## Security Best Practices

1. **Never commit AWS credentials** to version control
2. Use IAM roles with minimal permissions
3. Enable S3 versioning for data recovery
4. Set up CloudTrail for audit logging
5. Regularly rotate IAM access keys
6. Use CloudFront signed URLs for private content (if needed)
7. Enable S3 encryption at rest

## Troubleshooting

### Files not accessible (403 Forbidden)
- Check bucket policy allows public read access
- Verify IAM user has correct permissions
- Check if "Block public access" is disabled

### Upload fails with "Access Denied"
- Verify AWS credentials are correct
- Check IAM user has `s3:PutObject` permission
- Ensure bucket name is correct

### Files uploaded but wrong URL format
- Check if CloudFront domain is configured correctly
- Verify bucket region matches `AWS_REGION`

### Development with local storage
- If S3 is not configured, the app falls back to local file storage
- Local files are stored in `backend/uploads/`
- This is not recommended for production

## Support

For issues related to:
- AWS S3: https://docs.aws.amazon.com/s3/
- AWS SDK: https://docs.aws.amazon.com/sdk-for-javascript/
- CloudFront: https://docs.aws.amazon.com/cloudfront/

## Rollback Plan

If you need to rollback to Cloudinary:

1. Restore Cloudinary environment variables in `.env`
2. Reinstall packages:
   ```bash
   npm install cloudinary multer-storage-cloudinary
   ```
3. Revert code changes:
   ```bash
   git checkout main -- backend/src/services/uploadService.js
   git checkout main -- backend/src/services/blogImageService.js
   ```

## Summary

After completing these steps, your application will:
- ✅ Store all new uploads in AWS S3
- ✅ Serve files from S3 (or CloudFront if configured)
- ✅ Support both S3 and legacy Cloudinary URLs
- ✅ Fall back to local storage if S3 is not configured
