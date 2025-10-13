import React, { useState, useEffect } from 'react';
import {
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Chip,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
  Pagination,
} from '@mui/material';
import {
  Download,
  FileText,
  Filter,
  Calendar,
  DollarSign,
  Package,
  Eye,
  RefreshCw,
  BarChart3,
  Clock,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react';
// Using standard date inputs instead of DatePicker due to dependency compatibility
import axios from 'axios';
import { formatCurrency } from '../utils/formatters';
import ExportDialog from '../components/ExportDialog';

const ExportPage = () => {
  // Filter state
  const [filters, setFilters] = useState({
    status: '',
    vendor: '',
    batch_name: '',
    search: '',
    date_from: null,
    date_to: null,
    amount_min: '',
    amount_max: '',
  });

  // Data state
  const [vendors, setVendors] = useState([]);
  const [batches, setBatches] = useState([]);
  const [exportPreview, setExportPreview] = useState(null);
  const [previewInvoices, setPreviewInvoices] = useState([]);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0
  });
  
  // Export dialog state
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  
  // UI state
  const [error, setError] = useState('');
  const [recentExports, setRecentExports] = useState([]);
  const [showInvoicePreview, setShowInvoicePreview] = useState(true);

  // Load initial data
  useEffect(() => {
    loadVendors();
    loadBatches();
    loadRecentExports();
  }, []);

  // Load preview when filters change
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      if (hasActiveFilters()) {
        // Reset to page 1 when filters change
        setPagination(prev => ({ ...prev, page: 1 }));
        loadExportPreview(1);
      } else {
        setExportPreview(null);
        setPreviewInvoices([]);
        setPagination(prev => ({ ...prev, page: 1, total: 0 }));
      }
    }, 500);

    return () => clearTimeout(debounceTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]); // hasActiveFilters and loadExportPreview are stable functions

  // Handle pagination changes
  const handlePageChange = (event, newPage) => {
    loadExportPreview(newPage);
  };

  // Status display helper (matching InvoicesPage logic)
  const getStatusDisplay = (processingStatus) => {
    const status = processingStatus || 'processed';
    const config = {
      processed: { 
        displayName: 'Pending Review', 
        color: 'warning.main', 
        icon: <AlertCircle size={16} color="#ed6c02" /> 
      },
      approved: { 
        displayName: 'Approved', 
        color: 'success.main', 
        icon: <CheckCircle size={16} color="#2e7d32" /> 
      },
      rejected: { 
        displayName: 'Rejected', 
        color: 'error.main', 
        icon: <XCircle size={16} color="#d32f2f" /> 
      }
    };

    return config[status] || { 
      displayName: 'Unknown', 
      color: 'text.secondary', 
      icon: <AlertCircle size={16} color="#9e9e9e" /> 
    };
  };

  const loadVendors = async () => {
    try {
      const response = await axios.get('/api/vendors');
      if (response.data.vendors) {
        setVendors(response.data.vendors);
      }
    } catch (error) {
      console.error('Failed to load vendors:', error);
      setError('Failed to load vendors');
    }
  };

  const loadBatches = async () => {
    try {
      const response = await axios.get('/api/batches/names');
      if (response.data.batches) {
        setBatches(response.data.batches.map(batch => batch.name));
      }
    } catch (error) {
      console.error('Failed to load batches:', error);
      setError('Failed to load batches');
    }
  };

  const loadRecentExports = async () => {
    try {
      const response = await axios.get('/api/exports/recent');
      if (response.data.success) {
        setRecentExports(response.data.exports || []);
      }
    } catch (error) {
      console.error('Failed to load recent exports:', error);
    }
  };

  const loadExportPreview = async (page = 1) => {
    setIsLoadingPreview(true);
    try {
      // Map frontend filters to API parameters
      const apiParams = {
        limit: pagination.limit,
        offset: (page - 1) * pagination.limit,
        search: filters.search,
        status: filters.status,
        batch_name: filters.batch_name,
        vendor_id: filters.vendor,
        start_date: filters.date_from ? filters.date_from.toISOString().split('T')[0] : undefined,
        end_date: filters.date_to ? filters.date_to.toISOString().split('T')[0] : undefined,
      };

      // Remove undefined values
      Object.keys(apiParams).forEach(key => {
        if (apiParams[key] === undefined || apiParams[key] === '') {
          delete apiParams[key];
        }
      });

      const previewResponse = await axios.get('/api/invoices', {
        params: apiParams
      });
      
      if (previewResponse.data && previewResponse.data.invoices) {
        const invoices = previewResponse.data.invoices;
        const totalCount = previewResponse.data.total || 0;
        
        // Calculate total amount across all filtered invoices (not just current page)
        let totalAmount = 0;
        if (page === 1 && totalCount > pagination.limit) {
          // For first page with more results, fetch summary separately
          try {
            const summaryResponse = await axios.get('/api/invoices', {
              params: { ...apiParams, limit: totalCount, offset: 0 }
            });
            totalAmount = summaryResponse.data.invoices?.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0) || 0;
          } catch {
            // Fallback to current page amount
            totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
          }
        } else {
          totalAmount = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
        }
        
        setExportPreview({
          totalInvoices: totalCount,
          totalAmount,
          statusBreakdown: invoices.reduce((acc, inv) => {
            const status = inv.processing_status || 'processed';
            // Map to display names for consistency
            const displayStatus = status === 'processed' ? 'pending' : status;
            acc[displayStatus] = (acc[displayStatus] || 0) + 1;
            return acc;
          }, {}),
        });
        
        setPreviewInvoices(invoices);
        setPagination(prev => ({
          ...prev,
          page,
          total: totalCount
        }));
      }
      setError('');
    } catch (error) {
      console.error('Failed to load export preview:', error);
      setError('Failed to load export preview: ' + (error.response?.data?.error || error.message));
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const hasActiveFilters = () => {
    return Object.values(filters).some(value => 
      value !== '' && value !== null && value !== undefined
    );
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  const clearAllFilters = () => {
    setFilters({
      status: '',
      vendor: '',
      batch_name: '',
      search: '',
      date_from: null,
      date_to: null,
      amount_min: '',
      amount_max: '',
    });
    setExportPreview(null);
  };

  const getActiveFilterChips = () => {
    const chips = [];
    if (filters.status) chips.push({ label: `Status: ${filters.status}`, key: 'status' });
    if (filters.vendor) {
      const vendor = vendors.find(v => v.id === filters.vendor);
      chips.push({ label: `Vendor: ${vendor?.name || filters.vendor}`, key: 'vendor' });
    }
    if (filters.batch_name) chips.push({ label: `Batch: ${filters.batch_name}`, key: 'batch_name' });
    if (filters.search) chips.push({ label: `Search: "${filters.search}"`, key: 'search' });
    if (filters.date_from || filters.date_to) {
      const dateRange = `${filters.date_from ? new Date(filters.date_from).toLocaleDateString() : '...'} - ${filters.date_to ? new Date(filters.date_to).toLocaleDateString() : '...'}`;
      chips.push({ label: `Date: ${dateRange}`, key: 'date' });
    }
    if (filters.amount_min || filters.amount_max) {
      const amountRange = `${filters.amount_min ? formatCurrency(filters.amount_min) : '...'} - ${filters.amount_max ? formatCurrency(filters.amount_max) : '...'}`;
      chips.push({ label: `Amount: ${amountRange}`, key: 'amount' });
    }
    return chips;
  };

  const removeFilter = (filterKey) => {
    if (filterKey === 'date') {
      setFilters(prev => ({ ...prev, date_from: null, date_to: null }));
    } else if (filterKey === 'amount') {
      setFilters(prev => ({ ...prev, amount_min: '', amount_max: '' }));
    } else {
      setFilters(prev => ({ ...prev, [filterKey]: '' }));
    }
  };

  return (
    <Box>
        <Box display="flex" alignItems="center" justifyContent="between" sx={{ mb: 3 }}>
          <Box display="flex" alignItems="center" gap={2}>
            <Package size={32} />
            <Typography variant="h4">
              Export AR Package
            </Typography>
          </Box>
        </Box>

        <Grid container spacing={3}>
          {/* Left Panel - Filters */}
          <Grid item xs={12} md={8}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Box display="flex" alignItems="center" gap={2} sx={{ mb: 3 }}>
                <Filter size={20} />
                <Typography variant="h6">Export Filters</Typography>
                {hasActiveFilters() && (
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={clearAllFilters}
                    startIcon={<RefreshCw size={16} />}
                  >
                    Clear All
                  </Button>
                )}
              </Box>

              <Grid container spacing={2}>
                {/* Basic Filters */}
                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Search Invoices"
                    placeholder="Invoice #, Customer, PO..."
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      label="Status"
                      onChange={(e) => handleFilterChange('status', e.target.value)}
                    >
                      <MenuItem value="">All Statuses</MenuItem>
                      <MenuItem value="pending">Pending Review</MenuItem>
                      <MenuItem value="approved">Approved</MenuItem>
                      <MenuItem value="rejected">Rejected</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Vendor</InputLabel>
                    <Select
                      value={filters.vendor}
                      label="Vendor"
                      onChange={(e) => handleFilterChange('vendor', e.target.value)}
                    >
                      <MenuItem value="">All Vendors</MenuItem>
                      {vendors.map(vendor => (
                        <MenuItem key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                {/* Advanced Filters */}
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Batch</InputLabel>
                    <Select
                      value={filters.batch_name}
                      label="Batch"
                      onChange={(e) => handleFilterChange('batch_name', e.target.value)}
                    >
                      <MenuItem value="">All Batches</MenuItem>
                      {batches.map(batch => (
                        <MenuItem key={batch} value={batch}>
                          {batch}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Date From"
                    type="date"
                    value={filters.date_from ? filters.date_from.toISOString().split('T')[0] : ''}
                    onChange={(e) => handleFilterChange('date_from', e.target.value ? new Date(e.target.value) : null)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <Calendar size={16} />,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    fullWidth
                    label="Date To"
                    type="date"
                    value={filters.date_to ? filters.date_to.toISOString().split('T')[0] : ''}
                    onChange={(e) => handleFilterChange('date_to', e.target.value ? new Date(e.target.value) : null)}
                    InputLabelProps={{ shrink: true }}
                    InputProps={{
                      startAdornment: <Calendar size={16} />,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Minimum Amount"
                    placeholder="0.00"
                    value={filters.amount_min}
                    onChange={(e) => handleFilterChange('amount_min', e.target.value)}
                    InputProps={{
                      startAdornment: <DollarSign size={16} />,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Maximum Amount"
                    placeholder="999999.99"
                    value={filters.amount_max}
                    onChange={(e) => handleFilterChange('amount_max', e.target.value)}
                    InputProps={{
                      startAdornment: <DollarSign size={16} />,
                    }}
                  />
                </Grid>
              </Grid>

              {/* Active Filter Chips */}
              {getActiveFilterChips().length > 0 && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Active Filters:
                  </Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {getActiveFilterChips().map(chip => (
                      <Chip
                        key={chip.key}
                        label={chip.label}
                        onDelete={() => removeFilter(chip.key)}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>

            {/* Export Preview */}
            {exportPreview && (
              <Paper sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                  <Eye size={20} />
                  <Typography variant="h6">Export Preview</Typography>
                </Box>

                <Grid container spacing={2}>
                  <Grid item xs={12} md={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <FileText size={24} color="#1976d2" />
                        <Typography variant="h4" sx={{ mt: 1, color: 'primary.main' }}>
                          {exportPreview.totalInvoices.toLocaleString()}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Invoices
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={3}>
                    <Card variant="outlined">
                      <CardContent sx={{ textAlign: 'center' }}>
                        <DollarSign size={24} color="#2e7d32" />
                        <Typography variant="h4" sx={{ mt: 1, color: 'success.main' }}>
                          {formatCurrency(exportPreview.totalAmount)}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          Total Value
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <Box>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>
                        Ready to Export
                      </Typography>
                      <Button
                        variant="contained"
                        size="large"
                        startIcon={<Download size={20} />}
                        onClick={() => setExportDialogOpen(true)}
                        fullWidth
                      >
                        Configure & Export Data
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Invoice Preview Table */}
            {exportPreview && (
              <Paper sx={{ p: 3, mt: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Box display="flex" alignItems="center" gap={2}>
                    <FileText size={20} />
                    <Typography variant="h6">
                      Invoice Preview ({exportPreview.totalInvoices} total invoices)
                    </Typography>
                  </Box>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={showInvoicePreview ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    onClick={() => setShowInvoicePreview(!showInvoicePreview)}
                  >
                    {showInvoicePreview ? 'Hide' : 'Show'} Table
                  </Button>
                </Box>

                <Collapse in={showInvoicePreview}>
                  {previewInvoices.length > 0 ? (
                    <>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Status</TableCell>
                              <TableCell>Invoice #</TableCell>
                              <TableCell>Vendor</TableCell>
                              <TableCell>Customer</TableCell>
                              <TableCell align="right">Amount</TableCell>
                              <TableCell>Date</TableCell>
                              <TableCell>Batch</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {previewInvoices.map((invoice) => {
                              const statusDisplay = getStatusDisplay(invoice.processing_status);
                              return (
                                <TableRow key={invoice.id} hover>
                                  <TableCell>
                                    <Box display="flex" alignItems="center" gap={1}>
                                      {statusDisplay.icon}
                                      <Typography 
                                        variant="body2" 
                                        sx={{ 
                                          color: statusDisplay.color,
                                          fontWeight: 'medium'
                                        }}
                                      >
                                        {statusDisplay.displayName}
                                      </Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" fontWeight="medium">
                                      {invoice.invoice_number || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {invoice.vendor_name || invoice.vendor_display_name || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {invoice.customer_name || 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography variant="body2" fontWeight="medium">
                                      {formatCurrency(invoice.total_amount)}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2">
                                      {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}
                                    </Typography>
                                  </TableCell>
                                  <TableCell>
                                    <Typography variant="body2" color="text.secondary">
                                      {invoice.batch_name || 'Single Upload'}
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      
                      {/* Pagination Controls */}
                      {pagination.total > pagination.limit && (
                        <Box display="flex" justifyContent="center" sx={{ mt: 3 }}>
                          <Pagination
                            count={Math.ceil(pagination.total / pagination.limit)}
                            page={pagination.page}
                            onChange={handlePageChange}
                            color="primary"
                            showFirstButton
                            showLastButton
                          />
                        </Box>
                      )}
                      
                      {/* Summary Info */}
                      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                        <Typography variant="body2" color="text.secondary">
                          Showing page {pagination.page} of {Math.ceil(pagination.total / pagination.limit)} 
                          ({((pagination.page - 1) * pagination.limit) + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} invoices)
                        </Typography>
                      </Box>
                    </>
                  ) : (
                    <Alert severity="info">
                      No invoices found matching the current filters. Try adjusting your search criteria.
                    </Alert>
                  )}
                </Collapse>
              </Paper>
            )}

            {isLoadingPreview && (
              <Paper sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                  <RefreshCw size={20} />
                  <Typography variant="h6">Loading Preview...</Typography>
                </Box>
                <LinearProgress />
              </Paper>
            )}
          </Grid>

          {/* Right Panel - Actions & Recent Exports */}
          <Grid item xs={12} md={4}>
            {/* Quick Actions */}
            <Card sx={{ mb: 3 }}>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>
                  Quick Export
                </Typography>
                <Box display="flex" flexDirection="column" gap={2}>
                  <Button
                    variant="outlined"
                    startIcon={<Download size={16} />}
                    onClick={() => setExportDialogOpen(true)}
                    fullWidth
                  >
                    Custom Export
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<FileText size={16} />}
                    onClick={() => {
                      // Quick export with default template
                      setExportDialogOpen(true);
                    }}
                    fullWidth
                  >
                    Standard Report
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<BarChart3 size={16} />}
                    onClick={() => {
                      // Quick financial export
                      setExportDialogOpen(true);
                    }}
                    fullWidth
                  >
                    Financial Summary
                  </Button>
                </Box>
              </CardContent>
            </Card>

            {/* Recent Exports */}
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" gap={2} sx={{ mb: 2 }}>
                  <Clock size={20} />
                  <Typography variant="h6">Recent Exports</Typography>
                </Box>

                {recentExports.length > 0 ? (
                  <List dense>
                    {recentExports.slice(0, 5).map(exportItem => (
                      <ListItem key={exportItem.id} divider>
                        <ListItemText
                          primary={exportItem.template_name || 'Custom Export'}
                          secondary={
                            <Box>
                              <Typography variant="caption" display="block">
                                {new Date(exportItem.created_at).toLocaleDateString()} • {exportItem.export_format?.toUpperCase()}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {exportItem.invoice_count} invoices • {formatCurrency(exportItem.total_amount || 0)}
                              </Typography>
                            </Box>
                          }
                        />
                        <ListItemSecondaryAction>
                          <Tooltip title="View Details">
                            <IconButton size="small">
                              <Eye size={16} />
                            </IconButton>
                          </Tooltip>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Alert severity="info" sx={{ mt: 1 }}>
                    No recent exports found. Create your first export above!
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Error Display */}
        {error && (
          <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* Export Dialog */}
        <ExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          appliedFilters={filters}
        />
      </Box>
  );
};

export default ExportPage;