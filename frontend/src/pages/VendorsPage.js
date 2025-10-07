import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Switch,
  FormControlLabel,
  Alert,
  CircularProgress,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel
} from '@mui/material';
import {
  Plus,
  Edit,
  Trash2,
  Code,
  Building2
} from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const VendorsPage = () => {
  const navigate = useNavigate();
  const [vendors, setVendors] = useState([]);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    display_name: '',
    active: true,
    extraction_prompt_id: ''
  });
  const [submitting, setSubmitting] = useState(false);

  // Load vendors and prompts on component mount
  useEffect(() => {
    loadVendors();
    loadPrompts();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/vendors');
      setVendors(response.data.vendors || []);
      setError(null);
    } catch (err) {
      console.error('Failed to load vendors:', err);
      const message = err.response?.data?.error || err.message || 'Failed to load vendors. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      const response = await axios.get('/api/prompts');
      // Get all prompts, not just templates, to allow assignment of any prompt
      setPrompts(response.data.prompts || []);
    } catch (err) {
      console.error('Failed to load prompts:', err);
      // Don't set error for prompts, it's not critical for vendor management
    }
  };

  const handleOpenDialog = (vendor = null) => {
    setEditingVendor(vendor);
    if (vendor) {
      setFormData({
        name: vendor.name,
        display_name: vendor.display_name || '',
        active: vendor.active,
        extraction_prompt_id: vendor.active_prompt_id || ''
      });
    } else {
      setFormData({
        name: '',
        display_name: '',
        active: true,
        extraction_prompt_id: ''
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingVendor(null);
    setFormData({ name: '', display_name: '', active: true, extraction_prompt_id: '' });
  };

  const handleManagePrompts = (vendor) => {
    // Navigate to prompts page with vendor filter
    navigate('/prompts', { state: { vendorFilter: vendor.id, vendorName: vendor.display_name || vendor.name } });
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);
      
      if (!formData.name.trim()) {
        setError('Vendor name is required');
        return;
      }

      if (editingVendor) {
        // Update existing vendor
        await axios.put(`/api/vendors/${editingVendor.id}`, formData);
      } else {
        // Create new vendor
        await axios.post('/api/vendors', formData);
      }

      await loadVendors();
      handleCloseDialog();
      setError(null);
    } catch (err) {
      console.error('Failed to save vendor:', err);
      const message = err.response?.data?.error || 'Failed to save vendor';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (vendor) => {
    try {
      await axios.delete(`/api/vendors/${vendor.id}`);
      await loadVendors();
      setDeleteConfirm(null);
      setError(null);
    } catch (err) {
      console.error('Failed to delete vendor:', err);
      const message = err.response?.data?.error || err.message || 'Failed to delete vendor';
      setError(message);
    }
  };

  const getStatusChip = (active) => {
    return (
      <Chip
        label={active ? 'Active' : 'Inactive'}
        color={active ? 'success' : 'default'}
        size="small"
      />
    );
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress size={60} />
      </Box>
    );
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Box display="flex" alignItems="center" gap={2}>
          <Building2 size={32} color="#1B4B8C" />
          <Typography variant="h4">
            Vendors
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={20} />}
          onClick={() => handleOpenDialog()}
          sx={{ background: 'linear-gradient(135deg, #1B4B8C, #2E7CE4)' }}
        >
          Add Vendor
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Vendors Table */}
      <Paper sx={{ background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(20px)' }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Vendor Name</TableCell>
                <TableCell>Display Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="center">Invoices</TableCell>
                <TableCell>Active Prompt</TableCell>
                <TableCell align="center">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {vendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 8 }}>
                    <Typography variant="body1" color="text.secondary">
                      No vendors found. Click "Add Vendor" to create your first vendor.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                vendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <Typography variant="body2" fontWeight={500}>
                        {vendor.name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {vendor.display_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {getStatusChip(vendor.active)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        label={vendor.invoice_count}
                        color={vendor.invoice_count > 0 ? 'primary' : 'default'}
                        size="small"
                        variant="outlined"
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {vendor.active_prompt_name}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box display="flex" gap={1} justifyContent="center">
                        <Tooltip title="Edit Vendor">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenDialog(vendor)}
                            sx={{ 
                              background: 'rgba(255, 255, 255, 0.8)',
                              '&:hover': { background: 'rgba(46, 124, 228, 0.1)' }
                            }}
                          >
                            <Edit size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Manage Prompts">
                          <IconButton
                            size="small"
                            onClick={() => handleManagePrompts(vendor)}
                            sx={{ 
                              background: 'rgba(255, 255, 255, 0.8)',
                              '&:hover': { background: 'rgba(46, 124, 228, 0.1)' }
                            }}
                          >
                            <Code size={16} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip 
                          title={vendor.invoice_count > 0 
                            ? `Cannot delete - ${vendor.invoice_count} invoice${vendor.invoice_count === 1 ? '' : 's'} exist` 
                            : "Delete Vendor"
                          }
                        >
                          <span>
                            <IconButton
                              size="small"
                              onClick={() => setDeleteConfirm(vendor)}
                              disabled={vendor.invoice_count > 0}
                              sx={{ 
                                background: 'rgba(255, 255, 255, 0.8)',
                                '&:hover': { 
                                  background: vendor.invoice_count > 0 ? 'rgba(255, 255, 255, 0.8)' : 'rgba(253, 126, 20, 0.1)' 
                                },
                                '&.Mui-disabled': {
                                  opacity: 0.5,
                                  background: 'rgba(255, 255, 255, 0.5)'
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Add/Edit Vendor Dialog */}
      <Dialog 
        open={openDialog} 
        onClose={handleCloseDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
        </DialogTitle>
        <DialogContent>
          <Box display="flex" flexDirection="column" gap={3} mt={1}>
            <TextField
              label="Vendor Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              placeholder="e.g., genesys, five9"
              helperText="Internal name (lowercase, no spaces recommended)"
            />
            <TextField
              label="Display Name"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              fullWidth
              placeholder="e.g., Genesys, Five9"
              helperText="Display name shown in the UI"
            />
            <FormControl fullWidth>
              <InputLabel>Active Extraction Prompt</InputLabel>
              <Select
                value={formData.extraction_prompt_id}
                onChange={(e) => setFormData({ ...formData, extraction_prompt_id: e.target.value })}
                label="Active Extraction Prompt"
              >
                <MenuItem value="">
                  <em>No prompt assigned</em>
                </MenuItem>
                {prompts.map((prompt) => (
                  <MenuItem key={prompt.id} value={prompt.id}>
                    {prompt.prompt_name} 
                    {prompt.version && ` (v${prompt.version})`}
                    {prompt.is_template && ' [Template]'}
                    {prompt.is_active && ' [Active]'}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                />
              }
              label="Active"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            variant="contained"
            disabled={submitting || !formData.name.trim()}
            sx={{ background: 'linear-gradient(135deg, #1B4B8C, #2E7CE4)' }}
          >
            {submitting ? <CircularProgress size={20} /> : (editingVendor ? 'Update' : 'Create')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={!!deleteConfirm} 
        onClose={() => setDeleteConfirm(null)}
        maxWidth="sm"
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Are you sure you want to delete vendor "{deleteConfirm?.display_name || deleteConfirm?.name}"?
            This action cannot be undone.
          </Typography>
          
          {deleteConfirm?.invoice_count > 0 ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                Cannot Delete Vendor
              </Typography>
              <Typography variant="body2">
                This vendor has {deleteConfirm.invoice_count} associated invoice{deleteConfirm.invoice_count === 1 ? '' : 's'}.
                You must delete all associated invoices before you can delete this vendor.
              </Typography>
            </Alert>
          ) : (
            <Alert severity="info" sx={{ mt: 2 }}>
              <Typography variant="body2">
                This vendor has no associated invoices and can be safely deleted.
              </Typography>
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)}>
            Cancel
          </Button>
          <Button 
            onClick={() => handleDelete(deleteConfirm)}
            color="error"
            variant="contained"
            disabled={deleteConfirm?.invoice_count > 0}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default VendorsPage;