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
import { Refresh as RefreshIcon } from '@mui/icons-material';
import apiClient from '../../api/client';

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
  const [users, setUsers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [search, setSearch] = useState('');

  const fetchAll = async () => {
    try {
      setLoading(true);
      setError('');

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
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
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
    </Box>
  );
}
