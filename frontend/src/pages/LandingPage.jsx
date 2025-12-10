import React, { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useCurrentUser } from '../context/UserContext.jsx';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Stack,
  AppBar,
  Toolbar,
  useTheme,
  useMediaQuery,
  Avatar,
  Paper,
  Chip,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Stepper,
  Step,
  StepLabel,
  Tab,
  Tabs,
  Rating,
  Divider,
  TextField,
  LinearProgress,
  Checkbox,
  FormControlLabel,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Tooltip,
  ListItemIcon
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Menu as MenuIcon,
  Speed as SpeedIcon,
  Security as SecurityIcon,
  CloudSync as CloudSyncIcon,
  Devices as DevicesIcon,
  Build as BuildIcon,
  Assignment as AssignmentIcon,
  TrendingUp as TrendingUpIcon,
  PlayCircleOutline as PlayIcon,
  Home as HomeIcon,
  ArrowForward as ArrowForwardIcon,
  Star as StarIcon,
  People as PeopleIcon,
  AutoAwesome as AutoAwesomeIcon,
  Close as CloseIcon,
  Business as BusinessIcon,
  RocketLaunch as RocketLaunchIcon,
  Add as AddIcon,
  Apartment as ApartmentIcon,
  LocationOn as LocationIcon,
  CameraAlt as CameraIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon,
  Warning as WarningIcon,
  Schedule as ScheduleIcon,
  Done as DoneIcon,
  Refresh as RefreshIcon,
  AttachMoney as MoneyIcon,
  Percent as PercentIcon
} from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import GradientButton from '../components/GradientButton';

// --- Styled Components & Animations ---

const FadeIn = ({ children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    transition={{ duration: 0.6, delay }}
  >
    {children}
  </motion.div>
);

// --- Interactive Demo Components ---

// Demo 1: Add Properties - Interactive property card builder
const PropertyDemo = () => {
  const [properties, setProperties] = useState([
    { id: 1, name: 'Sunset Apartments', units: 12, address: '123 Main St', status: 'active' }
  ]);
  const [showForm, setShowForm] = useState(false);
  const [newProperty, setNewProperty] = useState({ name: '', units: '', address: '' });
  const [isAdding, setIsAdding] = useState(false);

  const handleAddProperty = () => {
    if (newProperty.name && newProperty.units) {
      setIsAdding(true);
      setTimeout(() => {
        setProperties([...properties, {
          id: properties.length + 1,
          name: newProperty.name || 'New Property',
          units: parseInt(newProperty.units) || 1,
          address: newProperty.address || 'Address TBD',
          status: 'active'
        }]);
        setNewProperty({ name: '', units: '', address: '' });
        setShowForm(false);
        setIsAdding(false);
      }, 800);
    }
  };

  return (
    <Box sx={{ height: 320, overflow: 'hidden' }}>
      {/* Mini Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
          Your Properties ({properties.length})
        </Typography>
        <Button
          size="small"
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setShowForm(!showForm)}
          sx={{ 
            fontSize: '0.7rem', 
            py: 0.5,
            background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
          }}
        >
          Add Property
        </Button>
      </Box>

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#fff7f2', border: '1px dashed', borderColor: 'primary.main' }}>
              <Stack spacing={1}>
                <TextField
                  size="small"
                  placeholder="Property Name"
                  value={newProperty.name}
                  onChange={(e) => setNewProperty({ ...newProperty, name: e.target.value })}
                  sx={{ '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.75 } }}
                />
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    placeholder="Units"
                    type="number"
                    value={newProperty.units}
                    onChange={(e) => setNewProperty({ ...newProperty, units: e.target.value })}
                    sx={{ flex: 1, '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.75 } }}
                  />
                  <TextField
                    size="small"
                    placeholder="Address"
                    value={newProperty.address}
                    onChange={(e) => setNewProperty({ ...newProperty, address: e.target.value })}
                    sx={{ flex: 2, '& .MuiInputBase-input': { fontSize: '0.8rem', py: 0.75 } }}
                  />
                </Stack>
                <Button 
                  size="small" 
                  variant="contained" 
                  onClick={handleAddProperty}
                  disabled={isAdding || !newProperty.name}
                  sx={{ fontSize: '0.7rem' }}
                >
                  {isAdding ? 'Adding...' : 'Save Property'}
                </Button>
              </Stack>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Property List */}
      <Stack spacing={1} sx={{ maxHeight: showForm ? 140 : 240, overflow: 'auto' }}>
        {properties.map((property, index) => (
          <motion.div
            key={property.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Paper
              sx={{
                p: 1.5,
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': { 
                  bgcolor: '#fff7f2',
                  transform: 'translateX(4px)'
                }
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 1,
                  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white'
                }}
              >
                <ApartmentIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {property.name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="caption" color="text.secondary">
                    {property.units} units
                  </Typography>
                  <Typography variant="caption" color="text.secondary">•</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {property.address}
                  </Typography>
                </Stack>
              </Box>
              <Chip 
                label="Active" 
                size="small" 
                color="success" 
                sx={{ fontSize: '0.65rem', height: 20 }} 
              />
            </Paper>
          </motion.div>
        ))}
      </Stack>
    </Box>
  );
};

// Demo 2: Schedule Inspections - Interactive checklist
const InspectionDemo = () => {
  const [items, setItems] = useState([
    { id: 1, label: 'Check HVAC system', checked: true, photo: true },
    { id: 2, label: 'Inspect plumbing fixtures', checked: true, photo: true },
    { id: 3, label: 'Test smoke detectors', checked: false, photo: false },
    { id: 4, label: 'Verify electrical outlets', checked: false, photo: false },
    { id: 5, label: 'Check windows & doors', checked: false, photo: false },
  ]);
  const [showSuccess, setShowSuccess] = useState(false);

  const completedCount = items.filter(i => i.checked).length;
  const progress = (completedCount / items.length) * 100;

  const toggleItem = (id) => {
    setItems(items.map(item => {
      if (item.id === id) {
        const newChecked = !item.checked;
        if (newChecked && completedCount === items.length - 1) {
          setTimeout(() => setShowSuccess(true), 300);
          setTimeout(() => setShowSuccess(false), 2000);
        }
        return { ...item, checked: newChecked, photo: newChecked };
      }
      return item;
    }));
  };

  const addPhoto = (id) => {
    setItems(items.map(item => 
      item.id === id ? { ...item, photo: true } : item
    ));
  };

  return (
    <Box sx={{ height: 320, overflow: 'hidden' }}>
      {/* Header with Progress */}
      <Box sx={{ mb: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary">
            Move-In Inspection
          </Typography>
          <Chip 
            label={`${completedCount}/${items.length}`} 
            size="small"
            color={progress === 100 ? 'success' : 'default'}
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        </Stack>
        <LinearProgress 
          variant="determinate" 
          value={progress} 
          sx={{ 
            height: 6, 
            borderRadius: 3,
            bgcolor: '#fee2e2',
            '& .MuiLinearProgress-bar': {
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              borderRadius: 3
            }
          }} 
        />
      </Box>

      {/* Success Message */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
          >
            <Paper sx={{ p: 1.5, mb: 2, bgcolor: '#dcfce7', border: '1px solid #22c55e' }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 20 }} />
                <Typography variant="body2" fontWeight={600} color="#166534">
                  Inspection Complete! Report generated.
                </Typography>
              </Stack>
            </Paper>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Checklist */}
      <Stack spacing={0.5} sx={{ maxHeight: 230, overflow: 'auto' }}>
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <Paper
              sx={{
                p: 1,
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                cursor: 'pointer',
                transition: 'all 0.2s',
                bgcolor: item.checked ? '#f0fdf4' : 'white',
                border: '1px solid',
                borderColor: item.checked ? '#86efac' : 'divider',
                '&:hover': { bgcolor: item.checked ? '#dcfce7' : '#fafafa' }
              }}
              onClick={() => toggleItem(item.id)}
            >
              <Checkbox
                checked={item.checked}
                size="small"
                sx={{
                  p: 0.5,
                  color: '#d1d5db',
                  '&.Mui-checked': { color: '#22c55e' }
                }}
              />
              <Typography 
                variant="body2" 
                sx={{ 
                  flex: 1,
                  textDecoration: item.checked ? 'line-through' : 'none',
                  color: item.checked ? 'text.secondary' : 'text.primary',
                  fontSize: '0.8rem'
                }}
              >
                {item.label}
              </Typography>
              <Tooltip title={item.photo ? 'Photo attached' : 'Add photo'}>
                <IconButton 
                  size="small" 
                  onClick={(e) => { e.stopPropagation(); addPhoto(item.id); }}
                  sx={{ 
                    p: 0.5,
                    color: item.photo ? '#22c55e' : '#9ca3af'
                  }}
                >
                  <CameraIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Paper>
          </motion.div>
        ))}
      </Stack>
    </Box>
  );
};

// Demo 3: Track Maintenance - Interactive job tracker
const MaintenanceDemo = () => {
  const [jobs, setJobs] = useState([
    { id: 1, title: 'Fix leaking faucet', unit: 'Unit 4B', priority: 'high', status: 'in_progress', cost: 150 },
    { id: 2, title: 'Replace AC filter', unit: 'Unit 2A', priority: 'medium', status: 'pending', cost: 45 },
    { id: 3, title: 'Paint touch-up', unit: 'Unit 7C', priority: 'low', status: 'pending', cost: 200 },
  ]);

  const statusColors = {
    pending: { bg: '#fef3c7', color: '#92400e', label: 'Pending' },
    in_progress: { bg: '#dbeafe', color: '#1e40af', label: 'In Progress' },
    completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' }
  };

  const priorityColors = {
    high: '#ef4444',
    medium: '#f97316',
    low: '#22c55e'
  };

  const updateStatus = (id, newStatus) => {
    setJobs(jobs.map(job => 
      job.id === id ? { ...job, status: newStatus } : job
    ));
  };

  const totalCost = jobs.reduce((sum, job) => sum + job.cost, 0);
  const completedJobs = jobs.filter(j => j.status === 'completed').length;

  return (
    <Box sx={{ height: 320, overflow: 'hidden' }}>
      {/* Stats Header */}
      <Stack direction="row" spacing={1} mb={2}>
        <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#fff7f2' }}>
          <Typography variant="h6" fontWeight={700} color="primary.main">
            {jobs.length}
          </Typography>
          <Typography variant="caption" color="text.secondary">Active Jobs</Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#f0fdf4' }}>
          <Typography variant="h6" fontWeight={700} color="#22c55e">
            {completedJobs}
          </Typography>
          <Typography variant="caption" color="text.secondary">Completed</Typography>
        </Paper>
        <Paper sx={{ flex: 1, p: 1, textAlign: 'center', bgcolor: '#fef3c7' }}>
          <Typography variant="h6" fontWeight={700} color="#92400e">
            ${totalCost}
          </Typography>
          <Typography variant="caption" color="text.secondary">Total Cost</Typography>
        </Paper>
      </Stack>

      {/* Job List */}
      <Stack spacing={1} sx={{ maxHeight: 230, overflow: 'auto' }}>
        {jobs.map((job, index) => (
          <motion.div
            key={job.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Paper
              sx={{
                p: 1.5,
                border: '1px solid',
                borderColor: 'divider',
                borderLeft: '4px solid',
                borderLeftColor: priorityColors[job.priority]
              }}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} noWrap>
                    {job.title}
                  </Typography>
                  <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                    <Typography variant="caption" color="text.secondary">
                      {job.unit}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">•</Typography>
                    <Typography variant="caption" fontWeight={600} color="primary.main">
                      ${job.cost}
                    </Typography>
                  </Stack>
                </Box>
                <FormControl size="small" sx={{ minWidth: 100 }}>
                  <Select
                    value={job.status}
                    onChange={(e) => updateStatus(job.id, e.target.value)}
                    sx={{ 
                      fontSize: '0.7rem',
                      height: 28,
                      bgcolor: statusColors[job.status].bg,
                      '& .MuiSelect-select': { py: 0.5, px: 1 }
                    }}
                  >
                    <MenuItem value="pending" sx={{ fontSize: '0.75rem' }}>Pending</MenuItem>
                    <MenuItem value="in_progress" sx={{ fontSize: '0.75rem' }}>In Progress</MenuItem>
                    <MenuItem value="completed" sx={{ fontSize: '0.75rem' }}>Completed</MenuItem>
                  </Select>
                </FormControl>
              </Stack>
            </Paper>
          </motion.div>
        ))}
      </Stack>
    </Box>
  );
};

// Demo 4: Analytics - Interactive dashboard
const AnalyticsDemo = () => {
  const [selectedMetric, setSelectedMetric] = useState('occupancy');
  const [animatedValues, setAnimatedValues] = useState({
    occupancy: 0,
    revenue: 0,
    maintenance: 0
  });

  const metrics = {
    occupancy: { value: 94, label: 'Occupancy Rate', suffix: '%', color: '#22c55e', trend: '+2.3%' },
    revenue: { value: 47500, label: 'Monthly Revenue', prefix: '$', color: '#3b82f6', trend: '+8.1%' },
    maintenance: { value: 12, label: 'Open Tickets', suffix: '', color: '#f97316', trend: '-15%' }
  };

  // Animate values on mount
  React.useEffect(() => {
    const duration = 1500;
    const steps = 30;
    const interval = duration / steps;
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      const progress = step / steps;
      setAnimatedValues({
        occupancy: Math.round(metrics.occupancy.value * progress),
        revenue: Math.round(metrics.revenue.value * progress),
        maintenance: Math.round(metrics.maintenance.value * progress)
      });
      if (step >= steps) clearInterval(timer);
    }, interval);

    return () => clearInterval(timer);
  }, []);

  // Mini bar chart data
  const chartData = [
    { month: 'Jul', value: 85 },
    { month: 'Aug', value: 88 },
    { month: 'Sep', value: 92 },
    { month: 'Oct', value: 90 },
    { month: 'Nov', value: 94 },
    { month: 'Dec', value: 94 },
  ];

  return (
    <Box sx={{ height: 320, overflow: 'hidden' }}>
      {/* Metric Cards */}
      <Stack direction="row" spacing={1} mb={2}>
        {Object.entries(metrics).map(([key, metric]) => (
          <Paper
            key={key}
            onClick={() => setSelectedMetric(key)}
            sx={{
              flex: 1,
              p: 1.5,
              cursor: 'pointer',
              transition: 'all 0.2s',
              border: '2px solid',
              borderColor: selectedMetric === key ? metric.color : 'transparent',
              bgcolor: selectedMetric === key ? `${metric.color}10` : 'white',
              '&:hover': { transform: 'translateY(-2px)', boxShadow: 1 }
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
              {metric.label}
            </Typography>
            <Typography variant="h6" fontWeight={700} sx={{ color: metric.color, fontSize: '1.1rem' }}>
              {metric.prefix}{animatedValues[key].toLocaleString()}{metric.suffix}
            </Typography>
            <Chip
              label={metric.trend}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.6rem',
                bgcolor: metric.trend.startsWith('+') ? '#dcfce7' : '#fee2e2',
                color: metric.trend.startsWith('+') ? '#166534' : '#991b1b'
              }}
            />
          </Paper>
        ))}
      </Stack>

      {/* Mini Chart */}
      <Paper sx={{ p: 2, bgcolor: '#fafafa' }}>
        <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 1.5, display: 'block' }}>
          {metrics[selectedMetric].label} Trend
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 100 }}>
          {chartData.map((item, index) => (
            <Tooltip key={item.month} title={`${item.month}: ${item.value}%`}>
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${item.value}%` }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                style={{
                  flex: 1,
                  background: index === chartData.length - 1 
                    ? 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)'
                    : '#e5e7eb',
                  borderRadius: 4,
                  cursor: 'pointer',
                  minHeight: 8
                }}
              />
            </Tooltip>
          ))}
        </Box>
        <Stack direction="row" justifyContent="space-between" mt={1}>
          {chartData.map(item => (
            <Typography key={item.month} variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem', flex: 1, textAlign: 'center' }}>
              {item.month}
            </Typography>
          ))}
        </Stack>
      </Paper>

      {/* Quick Stats */}
      <Stack direction="row" spacing={1} mt={2}>
        <Paper sx={{ flex: 1, p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <CheckCircleIcon sx={{ color: '#22c55e', fontSize: 18 }} />
          <Box>
            <Typography variant="caption" fontWeight={600}>98%</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
              Compliance
            </Typography>
          </Box>
        </Paper>
        <Paper sx={{ flex: 1, p: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
          <ScheduleIcon sx={{ color: '#3b82f6', fontSize: 18 }} />
          <Box>
            <Typography variant="caption" fontWeight={600}>2.4 days</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.6rem' }}>
              Avg Response
            </Typography>
          </Box>
        </Paper>
      </Stack>
    </Box>
  );
};

// Map step index to demo component
const DemoComponents = {
  0: PropertyDemo,
  1: InspectionDemo,
  2: MaintenanceDemo,
  3: AnalyticsDemo
};

const VideoPlaceholder = () => (
  <Box
    sx={{
      position: 'relative',
      width: '100%',
      paddingTop: '56.25%', // 16:9 aspect ratio
      backgroundColor: '#000',
      borderRadius: 4,
      overflow: 'hidden',
      boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
      mb: 6,
      cursor: 'pointer',
      '&:hover .play-button': {
        transform: 'translate(-50%, -50%) scale(1.1)',
      }
    }}
  >
    <Box
      component="img"
      src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80"
      alt="App Demo"
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        opacity: 0.6,
      }}
    />
    <Box
      className="play-button"
      sx={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        transition: 'transform 0.3s ease',
        color: 'white',
      }}
    >
      <PlayIcon sx={{ fontSize: 80, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' }} />
    </Box>
  </Box>
);

// --- Components ---

const Navbar = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  const navLinks = [
    { label: 'Features', path: '#features' },
    { label: 'How It Works', path: '#how-it-works' },
    { label: 'Pricing', path: '#pricing' },
    { label: 'Blog', path: '/blog' },
  ];

  return (
    <AppBar
      position="sticky"
      color="default"
      elevation={0}
      sx={{
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'rgba(255, 245, 245, 0.85)',
        backdropFilter: 'blur(12px)',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
      }}
    >
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: { xs: 64, md: 72 }, px: { xs: 2, md: 0 } }}>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textDecoration: 'none',
              transition: 'all 0.2s ease-in-out',
              '&:hover': {
                transform: 'scale(1.02)',
              },
            }}
          >
            BuildState FM
          </Typography>

          {isMobile ? (
            <>
              <Stack direction="row" spacing={1} alignItems="center">
                <Button
                  variant="outlined"
                  color="primary"
                  component={RouterLink}
                  to="/signin"
                  size="small"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2,
                    minWidth: 'auto'
                  }}
                >
                  Sign In
                </Button>
                <IconButton onClick={() => setDrawerOpen(true)}>
                  <MenuIcon />
                </IconButton>
              </Stack>
              <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)}>
                <List sx={{ width: 250 }}>
                  {navLinks.map((link) => (
                    <ListItem key={link.label} disablePadding>
                      <ListItemButton component={RouterLink} to={link.path} onClick={() => setDrawerOpen(false)}>
                        <ListItemText primary={link.label} />
                      </ListItemButton>
                    </ListItem>
                  ))}
                  <ListItem sx={{ mt: 2 }}>
                    <GradientButton fullWidth component={RouterLink} to="/signup">
                      Get Started Free
                    </GradientButton>
                  </ListItem>
                </List>
              </Drawer>
            </>
          ) : (
            <Stack direction="row" alignItems="center" spacing={4}>
              <Stack direction="row" spacing={3}>
                {navLinks.map((link) => (
                  <Typography
                    key={link.label}
                    component={link.path.startsWith('#') ? 'a' : RouterLink}
                    to={link.path.startsWith('#') ? undefined : link.path}
                    href={link.path.startsWith('#') ? link.path : undefined}
                    variant="body2"
                    sx={{
                      textDecoration: 'none',
                      color: 'text.secondary',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'color 0.2s',
                      '&:hover': { color: 'primary.main' }
                    }}
                  >
                    {link.label}
                  </Typography>
                ))}
              </Stack>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="outlined"
                  color="primary"
                  component={RouterLink}
                  to="/signin"
                  sx={{
                    fontWeight: 600,
                    textTransform: 'none',
                    borderRadius: 2,
                    px: 2.5
                  }}
                >
                  Sign In
                </Button>
                <GradientButton component={RouterLink} to="/signup">
                  Get Started Free
                </GradientButton>
              </Stack>
            </Stack>
          )}
        </Toolbar>
      </Container>
    </AppBar>
  );
};

const Hero = () => (
  <Box
    sx={{
      background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)',
      pt: { xs: 8, md: 12 },
      pb: { xs: 8, md: 12 },
      overflow: 'hidden',
      position: 'relative'
    }}
  >
    {/* Decorative gradient blobs */}
    <Box
      sx={{
        position: 'absolute',
        top: -100,
        right: -100,
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}
    />
    <Box
      sx={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 400,
        height: 400,
        background: 'radial-gradient(circle, rgba(185, 28, 28, 0.08) 0%, transparent 70%)',
        borderRadius: '50%',
        pointerEvents: 'none'
      }}
    />

    <Container maxWidth="lg" sx={{ maxWidth: 1240, position: 'relative' }}>
      <Grid container spacing={6} alignItems="center">
        <Grid item xs={12} md={6}>
          <FadeIn>
            <Chip
              icon={<AutoAwesomeIcon />}
              label="New: AI-Powered Inspection Workflows"
              color="secondary"
              sx={{
                mb: 3,
                fontWeight: 600,
                px: 1,
                background: 'linear-gradient(135deg, #f97316 0%, #b91c1c 100%)',
                color: 'white'
              }}
            />
            <Typography
              variant="h1"
              fontWeight={800}
              sx={{
                mb: 3,
                fontSize: { xs: '2.5rem', md: '3.5rem' },
                lineHeight: 1.1,
                letterSpacing: '-0.02em',
                background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Property Management Built for Trust
            </Typography>
            <Typography
              variant="h5"
              color="text.secondary"
              sx={{
                mb: 5,
                lineHeight: 1.7,
                fontWeight: 400,
                fontSize: { xs: '1.1rem', md: '1.3rem' }
              }}
            >
              Stop chasing paperwork. Start making data-driven decisions with immutable audit trails,
              real-time sync, and a platform your entire team will love.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 5 }}>
              <GradientButton
                size="large"
                component={RouterLink}
                to="/signup"
                endIcon={<ArrowForwardIcon />}
                sx={{ px: 4, py: 1.5, fontSize: '1.1rem' }}
              >
                Start Free Trial
              </GradientButton>
              <Button
                variant="outlined"
                size="large"
                component="a"
                href="#how-it-works"
                sx={{
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 600,
                  textTransform: 'none',
                  borderWidth: 2,
                  borderRadius: 2,
                  color: 'primary.main',
                  borderColor: 'primary.main',
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: 'primary.dark',
                    bgcolor: 'rgba(185, 28, 28, 0.04)'
                  }
                }}
              >
                See How It Works
              </Button>
            </Stack>
            <Box sx={{ mt: 5, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Stack direction="row" spacing={-1}>
                {[11, 12, 13, 14, 15].map((i) => (
                  <Avatar
                    key={i}
                    src={`https://i.pravatar.cc/100?img=${i}`}
                    sx={{
                      border: '3px solid white',
                      width: 48,
                      height: 48
                    }}
                  />
                ))}
              </Stack>
              <Box>
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mb: 0.5 }}>
                  <Rating value={5} size="small" readOnly />
                  <Typography variant="caption" fontWeight="bold">5.0</Typography>
                </Stack>
                <Typography variant="body2" fontWeight={600} color="text.primary">
                  Trusted by 500+ Property Managers
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Managing 10,000+ units worldwide
                </Typography>
              </Box>
            </Box>
          </FadeIn>
        </Grid>
        <Grid item xs={12} md={6}>
          <FadeIn delay={0.2}>
            <VideoPlaceholder />
          </FadeIn>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

// Workflow demonstration component
const HowItWorks = () => {
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      label: 'Add Your Properties',
      icon: <HomeIcon />,
      title: 'Set Up Your Portfolio in Minutes',
      description: 'Import properties and units with our simple onboarding wizard. Add all essential details, amenities, and documentation in one centralized location.',
      features: ['Bulk property import', 'Unit-level tracking', 'Document management', 'Custom fields & tags']
    },
    {
      label: 'Schedule Inspections',
      icon: <AssignmentIcon />,
      title: 'Create Smart Inspection Workflows',
      description: 'Design custom checklists, assign inspections to technicians, and track completion status in real-time with photo evidence and digital signatures.',
      features: ['Custom checklists', 'Photo documentation', 'Digital signatures', 'Automated scheduling']
    },
    {
      label: 'Track Maintenance',
      icon: <BuildIcon />,
      title: 'Manage Jobs from Start to Finish',
      description: 'From service requests to work orders, track every maintenance job with cost estimates, vendor assignments, and completion verification.',
      features: ['Service request portal', 'Vendor management', 'Cost tracking', 'Priority levels']
    },
    {
      label: 'Analyze & Optimize',
      icon: <TrendingUpIcon />,
      title: 'Make Data-Driven Decisions',
      description: 'Access real-time analytics, generate compliance reports, and identify optimization opportunities across your entire portfolio.',
      features: ['Real-time dashboards', 'Compliance reports', 'Cost analysis', 'Performance metrics']
    }
  ];

  React.useEffect(() => {
    const timer = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box id="how-it-works" sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              fontSize: '0.875rem'
            }}
          >
            HOW IT WORKS
          </Typography>
          <Typography variant="h3" fontWeight={800} mb={2} mt={1}>
            From Setup to Success in 4 Steps
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth={700}
            mx="auto"
            sx={{ lineHeight: 1.7, fontWeight: 400 }}
          >
            BuildState FM streamlines your entire property management workflow.
            Here's how you'll transform your operations.
          </Typography>
        </Box>

        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Stepper activeStep={activeStep} orientation="vertical">
              {steps.map((step, index) => (
                <Step key={step.label} expanded>
                  <StepLabel
                    onClick={() => setActiveStep(index)}
                    sx={{ cursor: 'pointer' }}
                    StepIconProps={{
                      sx: {
                        fontSize: '2rem',
                        '&.Mui-active': {
                          color: 'primary.main',
                          transform: 'scale(1.2)'
                        },
                        '&.Mui-completed': {
                          color: 'secondary.main'
                        }
                      }
                    }}
                  >
                    <Typography variant="h6" fontWeight={700}>
                      {step.label}
                    </Typography>
                  </StepLabel>
                  <AnimatePresence mode="wait">
                    {activeStep === index && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <Box sx={{ pl: 4, pr: 2, pb: 3 }}>
                          <Typography variant="body1" color="text.secondary" paragraph>
                            {step.description}
                          </Typography>
                          <Stack spacing={1}>
                            {step.features.map((feature) => (
                              <Stack key={feature} direction="row" spacing={1} alignItems="center">
                                <CheckCircleIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                                <Typography variant="body2" color="text.secondary">
                                  {feature}
                                </Typography>
                              </Stack>
                            ))}
                          </Stack>
                        </Box>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Step>
              ))}
            </Stepper>
          </Grid>

          <Grid item xs={12} md={6}>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.4 }}
              >
                <Card
                  elevation={0}
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 4,
                    overflow: 'hidden',
                    background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)'
                  }}
                >
                  <Box
                    sx={{
                      p: 4,
                      background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                      color: 'white',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2
                    }}
                  >
                    <Box
                      sx={{
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(10px)'
                      }}
                    >
                      {React.cloneElement(steps[activeStep].icon, { sx: { fontSize: 36 } })}
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="h5" fontWeight={700}>
                        {steps[activeStep].title}
                      </Typography>
                    </Box>
                    <Chip
                      label="Try it!"
                      size="small"
                      sx={{
                        bgcolor: 'rgba(255, 255, 255, 0.25)',
                        color: 'white',
                        fontWeight: 600,
                        fontSize: '0.7rem',
                        animation: 'pulse 2s infinite',
                        '@keyframes pulse': {
                          '0%, 100%': { opacity: 1 },
                          '50%': { opacity: 0.7 }
                        }
                      }}
                    />
                  </Box>
                  <CardContent sx={{ p: 3 }}>
                    {/* Interactive Demo */}
                    {React.createElement(DemoComponents[activeStep])}
                  </CardContent>
                </Card>
              </motion.div>
            </AnimatePresence>
          </Grid>
        </Grid>

        <Box textAlign="center" mt={8}>
          <GradientButton
            size="large"
            component={RouterLink}
            to="/signup"
            endIcon={<ArrowForwardIcon />}
            sx={{ px: 5, py: 2, fontSize: '1.1rem' }}
          >
            Start Your Free Trial
          </GradientButton>
          <Typography variant="body2" color="text.secondary" mt={2}>
            No credit card required • Full access for 14 days
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

const Features = () => {
  const features = [
    { icon: <AssignmentIcon fontSize="large" color="primary" />, title: 'Smart Inspections', description: 'Customizable checklists, photo evidence, and instant report generation.' },
    { icon: <BuildIcon fontSize="large" color="primary" />, title: 'Maintenance Tracking', description: 'End-to-end job management from request to completion with cost tracking.' },
    { icon: <CloudSyncIcon fontSize="large" color="primary" />, title: 'Real-Time Sync', description: 'Instant updates across all devices. Never work with stale data again.' },
    { icon: <SecurityIcon fontSize="large" color="primary" />, title: 'Audit Trails', description: 'Every action is logged. immutable history for zero compliance risk.' },
    { icon: <DevicesIcon fontSize="large" color="primary" />, title: 'Mobile First', description: 'Native-feel experience for technicians in the field.' },
    { icon: <TrendingUpIcon fontSize="large" color="primary" />, title: 'Analytics', description: 'Deep insights into property performance and maintenance costs.' },
  ];

  return (
    <Box id="features" sx={{ py: { xs: 8, md: 12 }, background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              fontSize: '0.875rem'
            }}
          >
            FEATURES
          </Typography>
          <Typography variant="h3" fontWeight={800} mb={2} mt={1}>
            Everything You Need to Scale
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth={700}
            mx="auto"
            sx={{ lineHeight: 1.7, fontWeight: 400 }}
          >
            A complete operating system for modern property management teams.
          </Typography>
        </Box>
        <Grid container spacing={4}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <FadeIn delay={index * 0.1}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    bgcolor: 'white',
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.3s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(185, 28, 28, 0.1)',
                      borderColor: 'primary.main'
                    }
                  }}
                >
                  <CardContent sx={{ p: 4 }}>
                    <Box
                      sx={{
                        mb: 3,
                        width: 64,
                        height: 64,
                        borderRadius: 2,
                        background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        transition: 'transform 0.3s',
                        '&:hover': {
                          transform: 'rotate(5deg) scale(1.05)'
                        }
                      }}
                    >
                      {React.cloneElement(feature.icon, { sx: { fontSize: 32, color: 'white' } })}
                    </Box>
                    <Typography variant="h6" fontWeight={700} gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" lineHeight={1.7}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </FadeIn>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

const ImageShowcase = () => (
  <Box sx={{ py: 12, bgcolor: 'background.default' }}>
    <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
      <Grid container spacing={8} alignItems="center">
        <Grid item xs={12} md={6}>
          <FadeIn>
            <Box
              component="img"
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80"
              alt="Dashboard Analytics"
              sx={{ width: '100%', borderRadius: 4, boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
            />
          </FadeIn>
        </Grid>
        <Grid item xs={12} md={6}>
          <FadeIn delay={0.2}>
            <Typography variant="h4" fontWeight={800} mb={3}>
              Data-Driven Decisions
            </Typography>
            <Typography variant="body1" color="text.secondary" mb={4} fontSize="1.1rem">
              Visualize your portfolio's health at a glance. Track occupancy rates, maintenance costs, and inspection compliance in real-time.
            </Typography>
            <List>
              {['Instant Financial Reports', 'Occupancy Tracking', 'Maintenance Cost Analysis'].map((item) => (
                <ListItem key={item} disableGutters>
                  <CheckCircleIcon color="primary" sx={{ mr: 2 }} />
                  <ListItemText primary={item} primaryTypographyProps={{ fontWeight: 500 }} />
                </ListItem>
              ))}
            </List>
          </FadeIn>
        </Grid>
      </Grid>
    </Container>
  </Box>
);

// Testimonials section
const Testimonials = () => {
  const testimonials = [
    {
      name: 'Sarah Mitchell',
      role: 'Property Manager',
      company: 'Urban Living Properties',
      avatar: 'https://i.pravatar.cc/100?img=25',
      rating: 5,
      text: 'BuildState FM has completely transformed how we manage our portfolio. The inspection workflows alone have saved us 15+ hours per week.'
    },
    {
      name: 'James Rodriguez',
      role: 'Facilities Director',
      company: 'Apex Real Estate Group',
      avatar: 'https://i.pravatar.cc/100?img=33',
      rating: 5,
      text: 'The audit trail feature gives us complete peace of mind during compliance reviews. We can track every action, every time. It\'s a game changer.'
    },
    {
      name: 'Emily Chen',
      role: 'Operations Manager',
      company: 'Gateway Residential',
      avatar: 'https://i.pravatar.cc/100?img=45',
      rating: 5,
      text: 'Our maintenance costs dropped by 23% in the first quarter after implementing BuildState FM. The analytics help us spot issues before they become expensive problems.'
    }
  ];

  return (
    <Box sx={{ py: { xs: 8, md: 12 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
        <Box textAlign="center" mb={8}>
          <Typography
            variant="overline"
            sx={{
              color: 'primary.main',
              fontWeight: 'bold',
              letterSpacing: '0.1em',
              fontSize: '0.875rem'
            }}
          >
            TESTIMONIALS
          </Typography>
          <Typography variant="h3" fontWeight={800} mb={2} mt={1}>
            Trusted by Industry Leaders
          </Typography>
          <Typography
            variant="h6"
            color="text.secondary"
            maxWidth={700}
            mx="auto"
            sx={{ lineHeight: 1.7, fontWeight: 400 }}
          >
            See what property management professionals are saying about BuildState FM.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {testimonials.map((testimonial, index) => (
            <Grid item xs={12} md={4} key={index}>
              <FadeIn delay={index * 0.1}>
                <Card
                  elevation={0}
                  sx={{
                    height: '100%',
                    p: 4,
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    transition: 'all 0.3s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: '0 12px 24px rgba(185, 28, 28, 0.08)'
                    }
                  }}
                >
                  <Rating value={testimonial.rating} readOnly sx={{ mb: 2 }} />
                  <Typography
                    variant="body1"
                    sx={{
                      mb: 3,
                      lineHeight: 1.8,
                      fontStyle: 'italic',
                      color: 'text.secondary'
                    }}
                  >
                    "{testimonial.text}"
                  </Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Avatar
                      src={testimonial.avatar}
                      sx={{
                        width: 56,
                        height: 56,
                        border: '2px solid',
                        borderColor: 'primary.main'
                      }}
                    />
                    <Box>
                      <Typography variant="subtitle1" fontWeight={700}>
                        {testimonial.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {testimonial.role}
                      </Typography>
                      <Typography variant="caption" color="primary.main" fontWeight={600}>
                        {testimonial.company}
                      </Typography>
                    </Box>
                  </Stack>
                </Card>
              </FadeIn>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

// --- Pricing Section ---

const PRICING_TIERS = [
  {
    id: 'BASIC',
    name: 'Basic',
    price: 29,
    yearlyPrice: 290,
    description: 'Perfect for individual property managers getting started',
    icon: RocketLaunchIcon,
    features: [
      { text: 'Up to 10 properties', included: true },
      { text: 'Unlimited units', included: true },
      { text: 'Basic inspections', included: true },
      { text: 'Job management', included: true },
      { text: 'Service requests', included: true },
      { text: '1 property manager', included: true },
      { text: 'Email support', included: true },
      { text: 'Mobile access', included: true },
      { text: 'Maintenance plans & scheduling', included: false },
      { text: 'Analytics dashboard', included: false },
      { text: 'Recurring inspections', included: false },
      { text: 'Custom inspection templates', included: false },
    ],
    highlighted: false,
  },
  {
    id: 'PROFESSIONAL',
    name: 'Professional',
    price: 79,
    yearlyPrice: 790,
    description: 'For growing teams managing multiple properties',
    icon: StarIcon,
    features: [
      { text: 'Up to 50 properties', included: true },
      { text: 'Unlimited units', included: true },
      { text: 'Advanced inspections with templates', included: true },
      { text: 'Job management', included: true },
      { text: 'Service requests', included: true },
      { text: 'Up to 5 team members', included: true },
      { text: 'Priority email support', included: true },
      { text: 'Mobile access', included: true },
      { text: 'Maintenance plans & scheduling', included: true },
      { text: 'Analytics dashboard', included: true },
      { text: 'Recurring inspections', included: true },
      { text: 'Technician & owner invites', included: true },
    ],
    highlighted: true,
  },
  {
    id: 'ENTERPRISE',
    name: 'Enterprise',
    price: 149,
    yearlyPrice: 1490,
    description: 'For large organizations with complex needs',
    icon: BusinessIcon,
    features: [
      { text: 'Unlimited properties', included: true },
      { text: 'Unlimited units', included: true },
      { text: 'Advanced inspections with templates', included: true },
      { text: 'Job management', included: true },
      { text: 'Service requests', included: true },
      { text: 'Unlimited team members', included: true },
      { text: 'Dedicated support', included: true },
      { text: 'Mobile access', included: true },
      { text: 'Maintenance plans & scheduling', included: true },
      { text: 'Advanced analytics & reporting', included: true },
      { text: 'Custom inspection templates', included: true },
      { text: 'API access', included: true },
    ],
    highlighted: false,
  },
];

const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const PricingCard = ({ tier, onSelectPlan, isAuthenticated }) => {
  const Icon = tier.icon;
  const price = tier.price;

  return (
    <FadeIn delay={tier.highlighted ? 0.2 : 0.1}>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: tier.highlighted ? '2px solid' : '1px solid',
          borderColor: tier.highlighted ? 'primary.main' : 'divider',
          boxShadow: tier.highlighted ? 6 : 1,
          borderRadius: 3,
          bgcolor: 'white',
          overflow: 'visible',
          transition: 'all 0.3s ease-in-out',
          '&:hover': {
            boxShadow: tier.highlighted ? 8 : 3,
            transform: 'translateY(-4px)',
            borderColor: tier.highlighted ? 'primary.main' : 'primary.light',
          },
        }}
      >
        {tier.highlighted && (
          <Box
            sx={{
              position: 'absolute',
              top: -16,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 2,
            }}
          >
            <Chip
              label="MOST POPULAR"
              color="primary"
              sx={{
                fontWeight: 700,
                fontSize: '0.75rem',
                px: 2,
                py: 0.5,
                boxShadow: 2,
              }}
            />
          </Box>
        )}
        <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', p: 4, pt: tier.highlighted ? 6 : 4 }}>
          <Stack spacing={3} sx={{ flexGrow: 1 }}>
            {/* Header */}
            <Box sx={{ textAlign: 'center' }}>
              <Box
                sx={{
                  mb: 2,
                  width: 64,
                  height: 64,
                  borderRadius: 2,
                  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  mx: 'auto',
                  transition: 'transform 0.3s',
                  '&:hover': {
                    transform: 'rotate(5deg) scale(1.05)'
                  }
                }}
              >
                <Icon sx={{ fontSize: 32, color: 'white' }} />
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                {tier.name}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ minHeight: 40, lineHeight: 1.7 }}>
                {tier.description}
              </Typography>
            </Box>

            {/* Pricing */}
            <Box sx={{ textAlign: 'center' }}>
              <Box sx={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 0.5 }}>
                <Typography variant="h3" sx={{ fontWeight: 700 }}>
                  {formatCurrency(price)}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  /month
                </Typography>
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Billed monthly
              </Typography>
            </Box>

            <Divider />

            {/* Features */}
            <List dense sx={{ py: 0 }}>
              {tier.features.map((feature, index) => (
                <ListItem key={index} sx={{ px: 0, py: 0.5 }}>
                  <ListItemIcon sx={{ minWidth: 32 }}>
                    {feature.included ? (
                      <CheckCircleIcon color="success" fontSize="small" />
                    ) : (
                      <CloseIcon color="disabled" fontSize="small" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary={feature.text}
                    primaryTypographyProps={{
                      variant: 'body2',
                      color: feature.included ? 'text.primary' : 'text.disabled',
                    }}
                  />
                </ListItem>
              ))}
            </List>

            {/* CTA Button */}
            <Box sx={{ mt: 'auto', pt: 2 }}>
              {tier.highlighted ? (
                <GradientButton
                  size="large"
                  fullWidth
                  onClick={() => onSelectPlan(tier.id)}
                  endIcon={<ArrowForwardIcon />}
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 600,
                  }}
                >
                  {isAuthenticated ? 'Start Trial Today' : 'Start Free Trial'}
                </GradientButton>
              ) : (
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  fullWidth
                  onClick={() => onSelectPlan(tier.id)}
                  sx={{
                    py: 1.5,
                    fontSize: '1rem',
                    fontWeight: 600,
                    textTransform: 'none',
                    borderWidth: 2,
                    borderRadius: 2,
                    '&:hover': {
                      borderWidth: 2,
                      bgcolor: 'rgba(185, 28, 28, 0.04)'
                    }
                  }}
                >
                  {isAuthenticated ? 'Start Trial Today' : 'Start Free Trial'}
                </Button>
              )}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ textAlign: 'center', display: 'block', mt: 1 }}
              >
                14-day free trial • No credit card required
              </Typography>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </FadeIn>
  );
};

const Pricing = () => {
  const navigate = useNavigate();
  const { user } = useCurrentUser();

  const handleSelectPlan = (planId) => {
    if (user) {
      navigate(`/subscriptions?plan=${planId}`);
    } else {
      navigate(`/signup?plan=${planId}`);
    }
  };

  return (
    <Box
      id="pricing"
      sx={{
        py: { xs: 8, md: 12 },
        background: 'linear-gradient(180deg, #ffffff 0%, #fff7f2 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Decorative gradient blobs */}
      <Box
        sx={{
          position: 'absolute',
          top: -100,
          right: -100,
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(249, 115, 22, 0.1) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          bottom: -100,
          left: -100,
          width: 400,
          height: 400,
          background: 'radial-gradient(circle, rgba(185, 28, 28, 0.08) 0%, transparent 70%)',
          borderRadius: '50%',
          pointerEvents: 'none'
        }}
      />

      <Container maxWidth="lg" sx={{ maxWidth: 1240, position: 'relative' }}>
        <Stack spacing={{ xs: 4, sm: 5, md: 6 }}>
          {/* Header */}
          <FadeIn>
            <Box sx={{ textAlign: 'center' }}>
              <Typography
                variant="overline"
                sx={{
                  color: 'primary.main',
                  fontWeight: 'bold',
                  letterSpacing: '0.1em',
                  fontSize: '0.875rem'
                }}
              >
                PRICING
              </Typography>
              <Typography
                variant="h3"
                sx={{
                  fontWeight: 800,
                  mb: 2,
                  mt: 1,
                  fontSize: { xs: '2rem', md: '2.5rem' },
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}
              >
                Choose Your Plan
              </Typography>
              <Typography
                variant="h6"
                color="text.secondary"
                sx={{
                  maxWidth: 700,
                  mx: 'auto',
                  lineHeight: 1.7,
                  fontWeight: 400,
                  fontSize: { xs: '1rem', md: '1.2rem' }
                }}
              >
                Start with a 14-day free trial. No credit card required. Cancel anytime.
              </Typography>
            </Box>
          </FadeIn>

          {/* Pricing Cards */}
          <Grid container spacing={{ xs: 2, sm: 3, md: 4 }} alignItems="stretch" sx={{ pt: 2 }}>
            {PRICING_TIERS.map((tier) => (
              <Grid item xs={12} sm={12} md={4} key={tier.id}>
                <PricingCard
                  tier={tier}
                  onSelectPlan={handleSelectPlan}
                  isAuthenticated={!!user}
                />
              </Grid>
            ))}
          </Grid>

          {/* FAQ Section */}
          <Paper sx={{ p: { xs: 2, sm: 3, md: 4 }, bgcolor: 'grey.50', borderRadius: 3, mt: { xs: 4, md: 6 } }}>
            <Typography variant="h5" sx={{ fontWeight: 700, mb: 3, textAlign: 'center' }}>
              Frequently Asked Questions
            </Typography>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Do I need a credit card for the free trial?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    No! You can start your 14-day free trial without entering any payment information.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Can I change plans later?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Yes! You can upgrade or downgrade your plan at any time.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    What happens after my trial ends?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    You'll need to select a paid plan to continue. Your data will be preserved.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 0.5 }}>
                    Can I cancel anytime?
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Absolutely! Cancel anytime and retain access until the end of your billing period.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Stack>
      </Container>
    </Box>
  );
};

const CTA = () => (
  <Box
    sx={{
      py: { xs: 8, md: 12 },
      background: 'linear-gradient(135deg, #b91c1c 0%, #f97316 100%)',
      color: 'white',
      textAlign: 'center',
      position: 'relative',
      overflow: 'hidden'
    }}
  >
    {/* Decorative elements */}
    <Box
      sx={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.1)',
        pointerEvents: 'none'
      }}
    />
    <Box
      sx={{
        position: 'absolute',
        bottom: -100,
        left: -100,
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'rgba(255, 255, 255, 0.05)',
        pointerEvents: 'none'
      }}
    />

    <Container maxWidth="md" sx={{ position: 'relative' }}>
      <FadeIn>
        <Typography variant="h2" fontWeight={800} mb={3} sx={{ fontSize: { xs: '2rem', md: '3rem' } }}>
          Ready to Transform Your Operations?
        </Typography>
        <Typography variant="h5" mb={6} sx={{ opacity: 0.95, fontWeight: 400 }}>
          Join hundreds of property managers who have switched to BuildState FM.
          Start your free 14-day trial today—no credit card required.
        </Typography>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          justifyContent="center"
          alignItems="center"
        >
          <Button
            variant="contained"
            size="large"
            component={RouterLink}
            to="/signup"
            endIcon={<ArrowForwardIcon />}
            sx={{
              bgcolor: 'white',
              color: 'primary.main',
              px: 5,
              py: 2,
              fontSize: '1.2rem',
              fontWeight: 700,
              textTransform: 'none',
              borderRadius: 2,
              boxShadow: '0 8px 16px rgba(0, 0, 0, 0.2)',
              '&:hover': {
                bgcolor: 'grey.100',
                transform: 'translateY(-2px)',
                boxShadow: '0 12px 24px rgba(0, 0, 0, 0.25)'
              },
              transition: 'all 0.2s'
            }}
          >
            Start Free Trial
          </Button>
          <Button
            variant="outlined"
            size="large"
            component={RouterLink}
            to="/signin"
            sx={{
              borderColor: 'white',
              color: 'white',
              px: 5,
              py: 2,
              fontSize: '1.2rem',
              fontWeight: 600,
              textTransform: 'none',
              borderRadius: 2,
              borderWidth: 2,
              '&:hover': {
                borderWidth: 2,
                borderColor: 'white',
                bgcolor: 'rgba(255, 255, 255, 0.1)'
              }
            }}
          >
            Sign In
          </Button>
        </Stack>
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon />
            <Typography variant="body2">14-day free trial</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon />
            <Typography variant="body2">No credit card required</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <CheckCircleIcon />
            <Typography variant="body2">Cancel anytime</Typography>
          </Stack>
        </Box>
      </FadeIn>
    </Container>
  </Box>
);

const Footer = () => (
  <Box sx={{ py: 8, bgcolor: '#1a1a1a', color: 'grey.400' }}>
    <Container maxWidth="lg" sx={{ maxWidth: 1240 }}>
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Typography
            variant="h6"
            gutterBottom
            fontWeight={800}
            sx={{
              background: 'linear-gradient(135deg, #f87171 0%, #fb923c 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mb: 2
            }}
          >
            BuildState FM
          </Typography>
          <Typography variant="body2" mb={2} sx={{ lineHeight: 1.7 }}>
            The modern operating system for property management. Built for trust, speed, and compliance.
          </Typography>
          <Stack direction="row" spacing={1} mt={3}>
            <Chip
              label="Trusted"
              size="small"
              sx={{ bgcolor: 'rgba(185, 28, 28, 0.2)', color: 'white', fontWeight: 600 }}
            />
            <Chip
              label="Secure"
              size="small"
              sx={{ bgcolor: 'rgba(249, 115, 22, 0.2)', color: 'white', fontWeight: 600 }}
            />
          </Stack>
        </Grid>
        <Grid item xs={6} md={2}>
          <Typography variant="subtitle2" color="white" gutterBottom fontWeight={700}>
            Product
          </Typography>
          <Stack spacing={1.5} mt={2}>
            <Typography
              variant="body2"
              component="a"
              href="#features"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              Features
            </Typography>
            <Typography
              variant="body2"
              component="a"
              href="#how-it-works"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              How It Works
            </Typography>
            <Typography
              variant="body2"
              component="a"
              href="#pricing"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              Pricing
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={6} md={2}>
          <Typography variant="subtitle2" color="white" gutterBottom fontWeight={700}>
            Company
          </Typography>
          <Stack spacing={1.5} mt={2}>
            <Typography
              variant="body2"
              component={RouterLink}
              to="/blog"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              Blog
            </Typography>
            <Typography
              variant="body2"
              component={RouterLink}
              to="/about"
              sx={{
                color: 'inherit',
                textDecoration: 'none',
                transition: 'color 0.2s',
                '&:hover': { color: 'primary.light' }
              }}
            >
              About
            </Typography>
          </Stack>
        </Grid>
        <Grid item xs={12} md={4}>
          <Typography variant="subtitle2" color="white" gutterBottom fontWeight={700}>
            Get Started
          </Typography>
          <Typography variant="body2" mb={2} mt={2} sx={{ lineHeight: 1.7 }}>
            Start your free 14-day trial today. No credit card required.
          </Typography>
          <GradientButton
            size="small"
            component={RouterLink}
            to="/signup"
            sx={{ mt: 1 }}
          >
            Sign Up Free
          </GradientButton>
        </Grid>
      </Grid>
      <Box mt={8} pt={4} borderTop="1px solid #333">
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="body2" textAlign={{ xs: 'center', md: 'left' }}>
              © {new Date().getFullYear()} BuildState FM. All rights reserved.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack
              direction="row"
              spacing={2}
              justifyContent={{ xs: 'center', md: 'flex-end' }}
            >
              <Typography
                variant="body2"
                component={RouterLink}
                to="/privacy"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.light' }
                }}
              >
                Privacy
              </Typography>
              <Typography
                variant="body2"
                component={RouterLink}
                to="/terms"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { color: 'primary.light' }
                }}
              >
                Terms
              </Typography>
              <Typography
                variant="body2"
                component={RouterLink}
                to="/admin/blog/login"
                sx={{
                  color: 'inherit',
                  textDecoration: 'none',
                  '&:hover': { color: 'secondary.light' }
                }}
              >
                Admin
              </Typography>
            </Stack>
          </Grid>
        </Grid>
      </Box>
    </Container>
  </Box>
);

const LandingPage = () => {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar />
      <Hero />
      <HowItWorks />
      <Features />
      <ImageShowcase />
      <Testimonials />
      <Pricing />
      <CTA />
      <Footer />
    </Box>
  );
};

export default LandingPage;
