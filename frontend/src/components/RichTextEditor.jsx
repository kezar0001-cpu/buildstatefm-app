import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import TextAlign from '@tiptap/extension-text-align';
import Underline from '@tiptap/extension-underline';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight, common } from 'lowlight';
import { useState } from 'react';

// Create lowlight instance for syntax highlighting
const lowlight = createLowlight(common);
import {
  Box,
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Divider,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip
} from '@mui/material';
import FormatBoldIcon from '@mui/icons-material/FormatBold';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import FormatUnderlinedIcon from '@mui/icons-material/FormatUnderlined';
import FormatStrikethroughIcon from '@mui/icons-material/FormatStrikethrough';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import CodeIcon from '@mui/icons-material/Code';
import ImageIcon from '@mui/icons-material/Image';
import LinkIcon from '@mui/icons-material/Link';
import YouTubeIcon from '@mui/icons-material/YouTube';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import FormatAlignCenterIcon from '@mui/icons-material/FormatAlignCenter';
import FormatAlignRightIcon from '@mui/icons-material/FormatAlignRight';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import PropTypes from 'prop-types';

const RichTextEditor = ({ content, onChange, placeholder = 'Start writing...' }) => {
  const [mode, setMode] = useState('visual'); // 'visual' or 'html'
  const [htmlContent, setHtmlContent] = useState('');
  const [imageDialog, setImageDialog] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [linkDialog, setLinkDialog] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [youtubeDialog, setYoutubeDialog] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable extensions we're replacing with custom configurations
        codeBlock: false,
      }),
      Image,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 underline',
        },
      }),
      Youtube.configure({
        width: 640,
        height: 360,
      }),
      Placeholder.configure({
        placeholder,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      Underline,
      CodeBlockLowlight.configure({
        lowlight,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html);
    },
  });

  if (!editor) {
    return null;
  }

  const handleModeToggle = (event, newMode) => {
    if (newMode !== null) {
      if (newMode === 'html' && mode === 'visual') {
        setHtmlContent(editor.getHTML());
      } else if (newMode === 'visual' && mode === 'html') {
        editor.commands.setContent(htmlContent);
        onChange(htmlContent);
      }
      setMode(newMode);
    }
  };

  const handleHtmlChange = (e) => {
    const newHtml = e.target.value;
    setHtmlContent(newHtml);
    onChange(newHtml);
  };

  const addImage = () => {
    if (imageUrl) {
      editor.chain().focus().setImage({ src: imageUrl }).run();
      setImageUrl('');
      setImageDialog(false);
    }
  };

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setLinkDialog(false);
    }
  };

  const addYoutube = () => {
    if (youtubeUrl) {
      editor.commands.setYoutubeVideo({
        src: youtubeUrl,
      });
      setYoutubeUrl('');
      setYoutubeDialog(false);
    }
  };

  return (
    <Paper sx={{ border: 1, borderColor: 'divider' }}>
      {/* Toolbar */}
      <Box sx={{ p: 1, borderBottom: 1, borderColor: 'divider', display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Mode Toggle */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeToggle}
          size="small"
        >
          <ToggleButton value="visual">Visual</ToggleButton>
          <ToggleButton value="html">HTML</ToggleButton>
        </ToggleButtonGroup>

        {mode === 'visual' && (
          <>
            <Divider orientation="vertical" flexItem />

            {/* Text Formatting */}
            <Tooltip title="Bold">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleBold().run()}
                color={editor.isActive('bold') ? 'primary' : 'default'}
              >
                <FormatBoldIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Italic">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                color={editor.isActive('italic') ? 'primary' : 'default'}
              >
                <FormatItalicIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Underline">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleUnderline().run()}
                color={editor.isActive('underline') ? 'primary' : 'default'}
              >
                <FormatUnderlinedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Strikethrough">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                color={editor.isActive('strike') ? 'primary' : 'default'}
              >
                <FormatStrikethroughIcon />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Headings */}
            <ToggleButtonGroup size="small" exclusive>
              <ToggleButton
                value="h1"
                selected={editor.isActive('heading', { level: 1 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              >
                H1
              </ToggleButton>
              <ToggleButton
                value="h2"
                selected={editor.isActive('heading', { level: 2 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              >
                H2
              </ToggleButton>
              <ToggleButton
                value="h3"
                selected={editor.isActive('heading', { level: 3 })}
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              >
                H3
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem />

            {/* Lists */}
            <Tooltip title="Bullet List">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                color={editor.isActive('bulletList') ? 'primary' : 'default'}
              >
                <FormatListBulletedIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Numbered List">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                color={editor.isActive('orderedList') ? 'primary' : 'default'}
              >
                <FormatListNumberedIcon />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Alignment */}
            <Tooltip title="Align Left">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().setTextAlign('left').run()}
                color={editor.isActive({ textAlign: 'left' }) ? 'primary' : 'default'}
              >
                <FormatAlignLeftIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Align Center">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().setTextAlign('center').run()}
                color={editor.isActive({ textAlign: 'center' }) ? 'primary' : 'default'}
              >
                <FormatAlignCenterIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Align Right">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().setTextAlign('right').run()}
                color={editor.isActive({ textAlign: 'right' }) ? 'primary' : 'default'}
              >
                <FormatAlignRightIcon />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Block Elements */}
            <Tooltip title="Quote">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                color={editor.isActive('blockquote') ? 'primary' : 'default'}
              >
                <FormatQuoteIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Code Block">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                color={editor.isActive('codeBlock') ? 'primary' : 'default'}
              >
                <CodeIcon />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Media */}
            <Tooltip title="Insert Image">
              <IconButton size="small" onClick={() => setImageDialog(true)}>
                <ImageIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Insert Link">
              <IconButton size="small" onClick={() => setLinkDialog(true)}>
                <LinkIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Embed YouTube">
              <IconButton size="small" onClick={() => setYoutubeDialog(true)}>
                <YouTubeIcon />
              </IconButton>
            </Tooltip>

            <Divider orientation="vertical" flexItem />

            {/* Undo/Redo */}
            <Tooltip title="Undo">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
              >
                <UndoIcon />
              </IconButton>
            </Tooltip>

            <Tooltip title="Redo">
              <IconButton
                size="small"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
              >
                <RedoIcon />
              </IconButton>
            </Tooltip>
          </>
        )}
      </Box>

      {/* Editor Content */}
      <Box
        sx={{
          p: 2,
          minHeight: 400,
          maxHeight: 600,
          overflow: 'auto',
          '& .ProseMirror': {
            outline: 'none',
            '& > * + *': {
              marginTop: '0.75em',
            },
            '& h1, & h2, & h3': {
              fontWeight: 700,
              lineHeight: 1.3,
            },
            '& h1': { fontSize: '2em' },
            '& h2': { fontSize: '1.5em' },
            '& h3': { fontSize: '1.25em' },
            '& code': {
              backgroundColor: '#f5f5f5',
              borderRadius: 1,
              padding: '0.2em 0.4em',
              fontFamily: 'monospace',
            },
            '& pre': {
              background: '#1e293b',
              color: '#f1f5f9',
              fontFamily: 'monospace',
              padding: '0.75rem 1rem',
              borderRadius: 1,
              overflow: 'auto',
              '& code': {
                color: 'inherit',
                padding: 0,
                background: 'none',
                fontSize: '0.875rem',
              },
            },
            '& blockquote': {
              paddingLeft: '1rem',
              borderLeft: '3px solid #cbd5e1',
              fontStyle: 'italic',
              color: '#64748b',
            },
            '& img': {
              maxWidth: '100%',
              height: 'auto',
              borderRadius: 1,
            },
            '& a': {
              color: '#3b82f6',
              textDecoration: 'underline',
            },
            '& ul, & ol': {
              paddingLeft: '1.5rem',
            },
          },
          '& .ProseMirror p.is-editor-empty:first-child::before': {
            content: 'attr(data-placeholder)',
            float: 'left',
            color: '#adb5bd',
            pointerEvents: 'none',
            height: 0,
          },
        }}
      >
        {mode === 'visual' ? (
          <EditorContent editor={editor} />
        ) : (
          <TextField
            multiline
            fullWidth
            value={htmlContent}
            onChange={handleHtmlChange}
            variant="outlined"
            minRows={15}
            sx={{
              '& .MuiInputBase-root': {
                fontFamily: 'monospace',
                fontSize: '0.875rem',
              },
            }}
          />
        )}
      </Box>

      {/* Image Dialog */}
      <Dialog open={imageDialog} onClose={() => setImageDialog(false)}>
        <DialogTitle>Insert Image</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Image URL"
            type="url"
            fullWidth
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImageDialog(false)}>Cancel</Button>
          <Button onClick={addImage} variant="contained">Insert</Button>
        </DialogActions>
      </Dialog>

      {/* Link Dialog */}
      <Dialog open={linkDialog} onClose={() => setLinkDialog(false)}>
        <DialogTitle>Insert Link</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Link URL"
            type="url"
            fullWidth
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkDialog(false)}>Cancel</Button>
          <Button onClick={addLink} variant="contained">Insert</Button>
        </DialogActions>
      </Dialog>

      {/* YouTube Dialog */}
      <Dialog open={youtubeDialog} onClose={() => setYoutubeDialog(false)}>
        <DialogTitle>Embed YouTube Video</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="YouTube URL"
            type="url"
            fullWidth
            value={youtubeUrl}
            onChange={(e) => setYoutubeUrl(e.target.value)}
            helperText="Paste the full YouTube video URL"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setYoutubeDialog(false)}>Cancel</Button>
          <Button onClick={addYoutube} variant="contained">Embed</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
};

RichTextEditor.propTypes = {
  content: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

export default RichTextEditor;
