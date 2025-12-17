
import React, { useState } from 'react';
import {
    Box,
    Button,
    Card,
    CardContent,
    CardMedia,
    Grid,
    Stack,
    IconButton,
    TextField,
    Typography,
    Chip,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    CloudUpload as CloudUploadIcon,
    Close as CloseIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { uploadPropertyImages } from '../utils/uploadPropertyImages';

// Helper to resolve image URL
// (Reusing logic from PropertyImageManager if possible, or just standard check)
const resolveImageUrl = (url) => {
    if (!url) return '';
    if (url.startsWith('http') || url.startsWith('data:')) return url;
    // If it's a relative path, prepend API URL or just return as is depending on setup
    // For now, assuming relative paths need backend URL logic, but client-side simple check
    return url;
};

export default function UnitImageManager({
    images = [],
    coverImageUrl,
    unitName,
    onChange,
    onUploadingChange,
    allowCaptions = true,
}) {
    const [isUploading, setIsUploading] = useState(false);
    const [urlDialogOpen, setUrlDialogOpen] = useState(false);
    const [newImageUrl, setNewImageUrl] = useState('');
    const [uploadError, setUploadError] = useState('');

    const handleFileUpload = async (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        setIsUploading(true);
        onUploadingChange?.(true);
        setUploadError('');

        try {
            // Reuse the existing upload utility if compatible, or implement basic upload
            // Assuming uploadPropertyImages returns array of { url, ... }
            const uploaded = await uploadPropertyImages(files);

            const newImages = uploaded.map((file) => ({
                url: file.url,
                imageUrl: file.url, // redundancy for compatibility
                caption: '',
                isPrimary: false, // will manage primary manually
            }));

            // Combine with existing
            const updatedList = [...images, ...newImages];

            // If no images previously, set first as primary implicitly by coverImageUrl logic in parent
            onChange(updatedList);

        } catch (error) {
            console.error('Upload failed:', error);
            setUploadError('Failed to upload images. Please try again.');
        } finally {
            setIsUploading(false);
            onUploadingChange?.(false);
            // Clear input
            event.target.value = '';
        }
    };

    const handleAddUrl = () => {
        if (!newImageUrl.trim()) return;

        const newImage = {
            url: newImageUrl.trim(),
            imageUrl: newImageUrl.trim(),
            caption: '',
            isPrimary: false,
        };

        const updatedList = [...images, newImage];
        onChange(updatedList);
        setNewImageUrl('');
        setUrlDialogOpen(false);
    };

    const handleDelete = (indexToDelete) => {
        const updatedList = images.filter((_, index) => index !== indexToDelete);
        onChange(updatedList);
    };

    const handleSetCover = (img) => {
        // In UnitForm, managing cover image logic might be handled by parent observing the list
        // But usually we set a specific one as primary or "cover"
        // For this component, we can just trigger a re-order or property update
        // The parent uses `coverImageUrl` to know which is cover.
        // If we want to change cover, we might need to communicate that.

        // However, UnitForm logic says:
        // "If we have images but no cover image, default to the first one"
        // And `handleUploadedImagesChange` sets `coverImageUrl` to the first image.
        // So to "set cover", we might need to update the parent's `coverImageUrl` state?
        // Looking at UnitForm: `setCoverImageUrl` is internal state.
        // But `handleUploadedImagesChange` only updates it if it was null.
        // So explicit "Make Cover" action needs to bubble up or we need to pass a setter?
        // `onChange` expects the array of images.

        // Let's assume for now we don't have explicit "Make Cover" in the props interface 
        // besides modifying the list or we add logic to handle it if needed.
        // Actually, `UnitForm` doesn't pass a "onSetCover" callback. 
        // But we can implement a `isPrimary` toggle in the image object?

        // Let's implement basic add/remove first as that's critical. 
        // "Star" icon logic:
        // If we want to support setting cover, we might need to bubble a custom event or 
        // just re-arrange so it's first?

        // For simplicity and to match likely expectations:
        // If user clicks Star, we make that image the first one or mark it `isPrimary`.
        // UnitForm doesn't seem to read `isPrimary` from the objects deeply, 
        // it reads `imageUrl` (cover) separately.

        // Let's just allow add/remove for now to fix the build.
    };

    return (
        <Box>
            <Stack direction="row" spacing={2} alignItems="center" mb={2}>
                <Button
                    component="label"
                    variant="outlined"
                    startIcon={<CloudUploadIcon />}
                    disabled={isUploading}
                >
                    {isUploading ? 'Uploading...' : 'Upload Images'}
                    <input
                        type="file"
                        hidden
                        multiple
                        accept="image/*"
                        onChange={handleFileUpload}
                    />
                </Button>

                <Button
                    variant="text"
                    startIcon={<AddIcon />}
                    onClick={() => setUrlDialogOpen(true)}
                    disabled={isUploading}
                >
                    Add via URL
                </Button>
            </Stack>

            {uploadError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setUploadError('')}>
                    {uploadError}
                </Alert>
            )}

            {images.length === 0 ? (
                <Alert severity="info" variant="outlined">
                    No images added for {unitName}.
                </Alert>
            ) : (
                <Grid container spacing={2}>
                    {images.map((img, index) => {
                        const src = img.url || img.imageUrl;
                        const isCover = src === coverImageUrl;

                        return (
                            <Grid item xs={6} sm={4} md={3} key={index}>
                                <Card variant="outlined" sx={{ position: 'relative' }}>
                                    <CardMedia
                                        component="img"
                                        height="140"
                                        image={resolveImageUrl(src)}
                                        alt={img.caption || 'Unit image'}
                                        sx={{ objectFit: 'cover' }}
                                    />
                                    <IconButton
                                        size="small"
                                        sx={{
                                            position: 'absolute',
                                            top: 4,
                                            right: 4,
                                            bgcolor: 'rgba(255,255,255,0.8)',
                                            '&:hover': { bgcolor: 'white' }
                                        }}
                                        onClick={() => handleDelete(index)}
                                    >
                                        <DeleteIcon fontSize="small" color="error" />
                                    </IconButton>
                                    {/* Optional: Star icon to indicate cover if we figure out logic */}
                                </Card>
                            </Grid>
                        );
                    })}
                </Grid>
            )}

            {/* Add URL Dialog */}
            <Dialog open={urlDialogOpen} onClose={() => setUrlDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>Add Image URL</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label="Image URL"
                        type="url"
                        fullWidth
                        variant="outlined"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setUrlDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleAddUrl} variant="contained" disabled={!newImageUrl.trim()}>
                        Add
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
