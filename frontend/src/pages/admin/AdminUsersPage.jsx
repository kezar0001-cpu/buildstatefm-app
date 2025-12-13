import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { Delete as DeleteIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import apiClient from '../../api/client';
import ConfirmDialog from '../../components/ConfirmDialog';

const ACTIVE_WINDOW_DAYS = 30;

function isRecentlyActive(lastLoginAt) {
  if (!lastLoginAt) return false;
  const last = new Date(lastLoginAt).getTime();
  if (Number.isNaN(last)) return false;
  return last >= Date.now() - ACTIVE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

function StatusChip({ label, color = 'default' }) {
  return <Chip label={label} size="small" color={color} sx={{ height: 22 }} />;
}

export default function AdminUsersPage() {
  const [tab, setTab] = useState('users');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [search, setSearch] = useState('');

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const [hardDeleteDialogOpen, setHardDeleteDialogOpen] = useState(false);
  const [hardDeleteUser, setHardDeleteUser] = useState(null);
  const [hardDeleteLoading, setHardDeleteLoading] = useState(false);
  const [hardDeleteError, setHardDeleteError] = useState('');
  const [hardDeletePreview, setHardDeletePreview] = useState(null);

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const [usersRes, invitesRes] = await Promise.all([
        apiClient.get('/admin/users', { params: { limit: 200, search: search || undefined } }),
        apiClient.get('/admin/invites', { params: { limit: 200, search: search || undefined } }),
      ]);

      setUsers(usersRes?.data?.data?.users || []);
      setInvites(invitesRes?.data?.data?.invites || []);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load user data');
    } finally {
      setLoading(false);
    }
  };

  const openHardDeleteDialog = async (user) => {
    if (!user?.id) return;
    try {
      setHardDeleteError('');
      setHardDeletePreview(null);
      setHardDeleteUser(user);
      setHardDeleteDialogOpen(true);
      setHardDeleteLoading(true);

      const previewRes = await apiClient.get(`/admin/users/${user.id}/deletion-preview`);
      setHardDeletePreview(previewRes?.data?.data || null);
    } catch (err) {
      setHardDeleteError(err?.response?.data?.message || 'Failed to load deletion preview');
    } finally {
      setHardDeleteLoading(false);
    }
  };

  const closeHardDeleteDialog = () => {
    if (hardDeleteLoading) return;
    setHardDeleteDialogOpen(false);
    setHardDeleteUser(null);
    setHardDeletePreview(null);
    setHardDeleteError('');
  };

  const confirmHardDelete = async () => {
    if (!hardDeleteUser?.id) return;
    try {
      setHardDeleteLoading(true);
      setHardDeleteError('');

      const res = await apiClient.delete(`/admin/users/${hardDeleteUser.id}/hard`, { params: { force: true } });
      setSuccess(res?.data?.message || 'User hard-deleted');
      closeHardDeleteDialog();
      await fetchAll();
    } catch (err) {
      setHardDeleteError(err?.response?.data?.message || 'Failed to hard delete user');
    } finally {
      setHardDeleteLoading(false);
    }
  };

  const hardDeleteMessage = useMemo(() => {
    const email = hardDeleteUser?.email || 'this user';
    const counts = hardDeletePreview?.counts;
    if (!counts) {
      return `Hard delete ${email}? This will permanently remove the user record and may cascade-delete related data.`;
    }

    const summary = [
      `Managed properties: ${counts.managedProperties ?? 0}`,
      `Owned properties: ${counts.ownedProperties ?? 0}`,
      `Service requests requested: ${counts.serviceRequestsRequested ?? 0}`,
      `Jobs created: ${counts.jobsCreated ?? 0}`,
      `Jobs assigned: ${counts.jobsAssigned ?? 0}`,
      `Job comments: ${counts.jobComments ?? 0}`,
      `Recommendation comments: ${counts.recommendationComments ?? 0}`,
      `Invites accepted (linked): ${counts.invitesAccepted ?? 0}`,
    ].join(' | ');

    const warning = hardDeletePreview?.wouldCascadeDeleteCoreData
      ? 'WARNING: core data detected (use extreme caution; this can cascade-delete data).'
      : 'No core data detected, but this is still irreversible.';

    return `Hard delete ${email}? ${warning} ${summary}`;
  }, [hardDeletePreview, hardDeleteUser]);

  const openDeleteDialog = (user) => {
    setDeleteError('');
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (deleteLoading) return;
    setDeleteDialogOpen(false);
    setUserToDelete(null);
    setDeleteError('');
  };

  const confirmDelete = async () => {
    if (!userToDelete?.id) return;
    try {
      setDeleteLoading(true);
      setDeleteError('');

      const res = await apiClient.delete(`/admin/users/${userToDelete.id}`);
      setSuccess(res?.data?.message || 'User deleted');
      closeDeleteDialog();
      await fetchAll();
    } catch (err) {
      setDeleteError(err?.response?.data?.message || 'Failed to delete user');
    } finally {
      setDeleteLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const userSummary = useMemo(() => {
    const total = users.length;
    const recentlyActive = users.filter((u) => isRecentlyActive(u.lastLoginAt)).length;
    const flaggedInactive = users.filter((u) => u.isActive === false).length;
    return { total, recentlyActive, flaggedInactive };
  }, [users]);

  return (
    <Box>
      <Typography variant="h4" gutterBottom fontWeight="bold">
        User Management
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 2 }}>
        View all accounts and invites.
      </Typography>

      <Alert severity="info" sx={{ mb: 2 }}>
        <strong>Active</strong> on the dashboard means: user logged in within the last {ACTIVE_WINDOW_DAYS} days (based on <code>lastLoginAt</code>).
        Separate from the <code>isActive</code> flag (account enabled/disabled).
      </Alert>

      <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'center' }}>
          <TextField
            label="Search (email/name)"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flex: 1, minWidth: 240 }}
          />
          <Button
            variant="contained"
            onClick={fetchAll}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ textTransform: 'none' }}
          >
            Refresh
          </Button>
        </Stack>

        <Divider sx={{ my: 2 }} />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
          <StatusChip label={`Total users: ${userSummary.total}`} color="primary" />
          <StatusChip label={`Recently active (${ACTIVE_WINDOW_DAYS}d): ${userSummary.recentlyActive}`} color="success" />
          <StatusChip label={`Disabled (isActive=false): ${userSummary.flaggedInactive}`} color="warning" />
        </Stack>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        sx={{ mb: 2 }}
      >
        <Tab value="users" label={`Users (${users.length})`} />
        <Tab value="invites" label={`Invites (${invites.length})`} />
      </Tabs>

      <Paper variant="outlined">
        {tab === 'users' ? (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Account</TableCell>
                <TableCell>Recently Active</TableCell>
                <TableCell>Last Login</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id} hover>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>{[u.firstName, u.lastName].filter(Boolean).join(' ') || '—'}</TableCell>
                    <TableCell>
                      <Chip label={u.role} size="small" />
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        <StatusChip label={u.isActive ? 'Enabled' : 'Disabled'} color={u.isActive ? 'success' : 'warning'} />
                        <StatusChip label={u.emailVerified ? 'Email verified' : 'Email unverified'} color={u.emailVerified ? 'success' : 'default'} />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      {isRecentlyActive(u.lastLoginAt) ? (
                        <StatusChip label="Yes" color="success" />
                      ) : (
                        <StatusChip label="No" />
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(u.lastLoginAt)}</TableCell>
                    <TableCell>{formatDateTime(u.createdAt)}</TableCell>
                    <TableCell align="right">
                      <Stack direction="row" spacing={1} justifyContent="flex-end">
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={<DeleteIcon />}
                          onClick={() => openDeleteDialog(u)}
                          sx={{ textTransform: 'none' }}
                        >
                          Delete
                        </Button>
                        <Button
                          variant="contained"
                          color="error"
                          size="small"
                          onClick={() => openHardDeleteDialog(u)}
                          sx={{ textTransform: 'none' }}
                        >
                          Hard Delete
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Email</TableCell>
                <TableCell>Role</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Expires</TableCell>
                <TableCell>Invited By</TableCell>
                <TableCell>Property/Unit</TableCell>
                <TableCell>Accepted User</TableCell>
                <TableCell>Created</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : invites.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                    No invites found
                  </TableCell>
                </TableRow>
              ) : (
                invites.map((inv) => {
                  const isExpired = inv.expiresAt ? new Date(inv.expiresAt).getTime() < Date.now() : false;
                  const statusColor =
                    inv.status === 'ACCEPTED' ? 'success' :
                    inv.status === 'PENDING' ? (isExpired ? 'warning' : 'info') :
                    'default';
                  const propertyLabel = inv.property?.name ? `${inv.property.name}` : '';
                  const unitLabel = inv.unit?.unitNumber ? `Unit ${inv.unit.unitNumber}` : '';
                  const scope = [propertyLabel, unitLabel].filter(Boolean).join(' · ') || '—';
                  const invitedBy = inv.invitedBy
                    ? `${[inv.invitedBy.firstName, inv.invitedBy.lastName].filter(Boolean).join(' ') || inv.invitedBy.email}`
                    : '—';
                  const acceptedUser = inv.invitedUser ? inv.invitedUser.email : '—';

                  return (
                    <TableRow key={inv.id} hover>
                      <TableCell>{inv.email}</TableCell>
                      <TableCell><Chip label={inv.role} size="small" /></TableCell>
                      <TableCell>
                        <StatusChip label={isExpired && inv.status === 'PENDING' ? 'EXPIRED' : inv.status} color={statusColor} />
                      </TableCell>
                      <TableCell>{formatDateTime(inv.expiresAt)}</TableCell>
                      <TableCell>{invitedBy}</TableCell>
                      <TableCell>{scope}</TableCell>
                      <TableCell>{acceptedUser}</TableCell>
                      <TableCell>{formatDateTime(inv.createdAt)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        onConfirm={confirmDelete}
        title="Delete User Account"
        message={`Delete ${userToDelete?.email || 'this user'}? This will disable their account and anonymize their identity. This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={deleteLoading}
        error={deleteError}
        disableBackdropClick
      />

      <ConfirmDialog
        open={hardDeleteDialogOpen}
        onClose={closeHardDeleteDialog}
        onConfirm={confirmHardDelete}
        title="Hard Delete User"
        message={hardDeleteMessage}
        confirmLabel="Hard Delete"
        cancelLabel="Cancel"
        variant="danger"
        isLoading={hardDeleteLoading}
        error={hardDeleteError}
        disableBackdropClick
      />
    </Box>
  );
}
