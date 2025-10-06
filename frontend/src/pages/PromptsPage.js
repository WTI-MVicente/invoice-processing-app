import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Paper,
  Box,
  Grid,
  Card,
  CardContent,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Tooltip,
  Collapse,
  Divider,
  LinearProgress
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Visibility as ViewIcon,
  PlayArrow as TestIcon,
  CheckCircle as ActivateIcon,
  Delete as DeleteIcon,
  History as HistoryIcon,
  FilterList as FilterIcon,
  Check as CheckIcon
} from '@mui/icons-material';

const PromptsPage = () => {
  const [prompts, setPrompts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Filtering states
  const [filters, setFilters] = useState({
    vendor_id: '',
    is_active: '',
    is_template: ''
  });
  
  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  
  // Selected prompt for operations
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  
  // Form states
  const [formData, setFormData] = useState({
    prompt_name: '',
    prompt_text: '',
    vendor_id: '',
    is_template: false,
    is_active: false,
    parent_prompt_id: null
  });
  const [formLoading, setFormLoading] = useState(false);
  
  // Test dialog states
  const [testData, setTestData] = useState({
    selectedFile: null,
    document_type: 'pdf',
    tempFileId: null,
    extractedContent: null
  });
  const [testLoading, setTestLoading] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [promptText, setPromptText] = useState('');
  
  // History dialog states
  const [historyVersions, setHistoryVersions] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  
  // Statistics
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    templates: 0,
    vendors: 0
  });

  const loadPrompts = useCallback(async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      // Build query parameters
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value);
      });
      
      const response = await fetch(`/api/prompts?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load prompts');
      }
      
      const data = await response.json();
      setPrompts(data.prompts || []);
      
      // Calculate statistics
      calculateStats(data.prompts || []);
      
    } catch (err) {
      setError('Failed to load prompts: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  // Load prompts and vendors on component mount
  useEffect(() => {
    loadPrompts();
    loadVendors();
  }, [loadPrompts]);

  const loadVendors = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/vendors', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setVendors(data.vendors || []);
      }
    } catch (err) {
      console.error('Failed to load vendors:', err);
    }
  };

  const calculateStats = (promptList) => {
    const vendorIds = new Set();
    let activeCount = 0;
    let templateCount = 0;
    
    promptList.forEach(prompt => {
      if (prompt.vendor_id) vendorIds.add(prompt.vendor_id);
      if (prompt.is_active) activeCount++;
      if (prompt.is_template) templateCount++;
    });
    
    setStats({
      total: promptList.length,
      active: activeCount,
      templates: templateCount,
      vendors: vendorIds.size
    });
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const clearFilters = () => {
    setFilters({
      vendor_id: '',
      is_active: '',
      is_template: ''
    });
  };

  const handleActivatePrompt = async (promptId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/prompts/${promptId}/activate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to activate prompt');
      }
      
      setSuccess('Prompt activated successfully');
      loadPrompts();
      
    } catch (err) {
      setError('Failed to activate prompt: ' + err.message);
    }
  };

  const handleDeletePrompt = async (promptId) => {
    if (!window.confirm('Are you sure you want to delete this prompt?')) {
      return;
    }
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/prompts/${promptId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete prompt');
      }
      
      setSuccess('Prompt deleted successfully');
      loadPrompts();
      
    } catch (err) {
      setError('Failed to delete prompt: ' + err.message);
    }
  };

  const getVendorName = (vendorId) => {
    const vendor = vendors.find(v => v.id === vendorId);
    return vendor ? vendor.display_name || vendor.name : 'Unknown Vendor';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (filename) => {
    if (filename && filename.toLowerCase().endsWith('.pdf')) {
      return '📄';
    }
    return '📝';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount || 0);
  };

  const resetForm = () => {
    setFormData({
      prompt_name: '',
      prompt_text: '',
      vendor_id: '',
      is_template: false,
      is_active: false,
      parent_prompt_id: null
    });
  };

  const handleCreatePrompt = () => {
    resetForm();
    setSelectedPrompt(null);
    setCreateDialogOpen(true);
  };

  const handleEditPrompt = (prompt) => {
    setFormData({
      prompt_name: prompt.prompt_name,
      prompt_text: prompt.prompt_text,
      vendor_id: prompt.vendor_id || '',
      is_template: prompt.is_template,
      is_active: prompt.is_active,
      parent_prompt_id: prompt.parent_prompt_id
    });
    setSelectedPrompt(prompt);
    setEditDialogOpen(true);
  };

  const handleFormSubmit = async () => {
    try {
      setFormLoading(true);
      const token = localStorage.getItem('token');
      
      const isEditing = selectedPrompt !== null;
      const url = isEditing 
        ? `/api/prompts/${selectedPrompt.id}` 
        : '/api/prompts';
      const method = isEditing ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to ${isEditing ? 'update' : 'create'} prompt`);
      }
      
      setSuccess(`Prompt ${isEditing ? 'updated' : 'created'} successfully`);
      setCreateDialogOpen(false);
      setEditDialogOpen(false);
      loadPrompts();
      
    } catch (err) {
      setError(`Failed to ${selectedPrompt ? 'update' : 'create'} prompt: ` + err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const loadTemplatePrompt = async () => {
    try {
      const template = prompts.find(p => p.is_template && p.prompt_name === 'Base Template');
      if (template) {
        setFormData(prev => ({
          ...prev,
          prompt_text: template.prompt_text
        }));
        setSuccess('Template prompt loaded');
      } else {
        setError('No base template found');
      }
    } catch (err) {
      setError('Failed to load template: ' + err.message);
    }
  };

  const handleTestPrompt = (prompt) => {
    setSelectedPrompt(prompt);
    setTestData({
      selectedFile: null,
      document_type: 'pdf',
      tempFileId: null,
      extractedContent: null
    });
    setTestResults(null);
    setPromptText(prompt.prompt_text); // Load current prompt
    setTestDialogOpen(true);
  };

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['application/pdf', 'text/html'];
      const allowedExtensions = ['.pdf', '.html', '.htm'];
      const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      
      if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension)) {
        setError('Please select a PDF or HTML file');
        return;
      }

      if (file.size > 10 * 1024 * 1024) { // 10MB
        setError('File size must be less than 10MB');
        return;
      }

      setTestData(prev => ({
        ...prev,
        selectedFile: file,
        document_type: file.type === 'application/pdf' ? 'pdf' : 'html',
        // Reset extraction data when new file is selected
        tempFileId: null,
        extractedContent: null
      }));
      setError('');
      setTestResults(null); // Clear previous test results
      
      // Auto-extract text from the selected file
      await handleExtractText(file);
    }
  };

  const handleExtractText = async (file = null) => {
    const fileToUpload = file || testData.selectedFile;
    if (!fileToUpload) {
      setError('Please select a file first');
      return false;
    }

    try {
      setUploadLoading(true);
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('testFile', fileToUpload);
      
      const response = await fetch(`/api/prompts/${selectedPrompt.id}/test-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload test file');
      }
      
      const result = await response.json();
      setTestData(prev => ({
        ...prev,
        tempFileId: result.tempFileId,
        extractedContent: result.extractedContent
      }));
      
      return true;
    } catch (err) {
      console.error('Upload failed:', err);
      setError('Failed to extract text from document: ' + err.message);
      return false;
    } finally {
      setUploadLoading(false);
    }
  };

  const uploadTestFile = async () => {
    if (!testData.selectedFile) {
      setError('Please select a file first');
      return false;
    }

    try {
      setUploadLoading(true);
      const token = localStorage.getItem('token');
      
      const formData = new FormData();
      formData.append('testFile', testData.selectedFile);
      
      const response = await fetch(`/api/prompts/${selectedPrompt.id}/test-upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      
      if (!response.ok) {
        throw new Error('Failed to upload test file');
      }
      
      const result = await response.json();
      setTestData(prev => ({
        ...prev,
        tempFileId: result.tempFileId,
        extractedContent: result.extractedContent
      }));
      
      return true;
    } catch (err) {
      setError('Failed to upload file: ' + err.message);
      return false;
    } finally {
      setUploadLoading(false);
    }
  };

  const validatePromptStructure = (promptText) => {
    const requiredFields = [
      'invoice_header', 'line_items', 'invoice_number', 'customer_name'
    ];
    
    const missingFields = requiredFields.filter(field => 
      !promptText.toLowerCase().includes(field.toLowerCase())
    );
    
    return {
      isValid: missingFields.length === 0,
      missingFields,
      warnings: missingFields.length > 0 ? [
        `Missing required fields: ${missingFields.join(', ')}`
      ] : []
    };
  };

  const runPromptTest = async () => {
    // Upload file if not already uploaded
    if (!testData.tempFileId && testData.selectedFile) {
      const uploaded = await uploadTestFile();
      if (!uploaded) return;
    }
    
    if (!testData.extractedContent) {
      setError('Please upload a file first');
      return;
    }
    
    // Validate prompt structure
    const validation = validatePromptStructure(promptText);
    if (!validation.isValid) {
      setError(`Prompt validation failed: ${validation.warnings.join(', ')}`);
      return;
    }
    
    try {
      setTestLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/prompts/${selectedPrompt.id}/test-run`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tempFileId: testData.tempFileId,
          promptText: promptText,
          document_type: testData.document_type
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to test prompt');
      }
      
      const result = await response.json();
      setTestResults(result);
      setSuccess('Prompt test completed successfully');
      
    } catch (err) {
      setError('Failed to test prompt: ' + err.message);
    } finally {
      setTestLoading(false);
    }
  };

  const handleViewHistory = async (prompt) => {
    setSelectedPrompt(prompt);
    setHistoryDialogOpen(true);
    
    try {
      setHistoryLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/prompts/${prompt.id}/history`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to load version history');
      }
      
      const data = await response.json();
      setHistoryVersions(data.versions || []);
      
    } catch (err) {
      setError('Failed to load version history: ' + err.message);
    } finally {
      setHistoryLoading(false);
    }
  };

  const StatCard = ({ title, value, color = 'primary' }) => (
    <Card sx={{ height: '100%' }}>
      <CardContent>
        <Typography color="text.secondary" gutterBottom>
          {title}
        </Typography>
        <Typography variant="h4" component="div" color={`${color}.main`}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Extraction Prompts
      </Typography>

      {/* Alert Messages */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Total Prompts" value={stats.total} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Active Prompts" value={stats.active} color="success" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Templates" value={stats.templates} color="info" />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard title="Vendors" value={stats.vendors} color="warning" />
        </Grid>
      </Grid>

      {/* Filters and Actions */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={3}>
            <FormControl fullWidth size="small">
              <InputLabel>Vendor</InputLabel>
              <Select
                value={filters.vendor_id}
                label="Vendor"
                onChange={(e) => handleFilterChange('vendor_id', e.target.value)}
              >
                <MenuItem value="">All Vendors</MenuItem>
                {vendors.map((vendor) => (
                  <MenuItem key={vendor.id} value={vendor.id}>
                    {vendor.display_name || vendor.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                value={filters.is_active}
                label="Status"
                onChange={(e) => handleFilterChange('is_active', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Active</MenuItem>
                <MenuItem value="false">Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <FormControl fullWidth size="small">
              <InputLabel>Type</InputLabel>
              <Select
                value={filters.is_template}
                label="Type"
                onChange={(e) => handleFilterChange('is_template', e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="true">Templates</MenuItem>
                <MenuItem value="false">Regular</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} md={3}>
            <Button
              variant="outlined"
              startIcon={<FilterIcon />}
              onClick={clearFilters}
              sx={{ mr: 1 }}
            >
              Clear Filters
            </Button>
          </Grid>
          
          <Grid item xs={12} md={2}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreatePrompt}
              fullWidth
            >
              New Prompt
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Prompts Table */}
      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Vendor</TableCell>
                <TableCell>Version</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <CircularProgress />
                  </TableCell>
                </TableRow>
              ) : prompts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center">
                    <Typography color="text.secondary">
                      No prompts found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                prompts.map((prompt) => (
                  <TableRow key={prompt.id} hover>
                    <TableCell>
                      <Typography variant="body2" fontWeight="medium">
                        {prompt.prompt_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      {prompt.vendor_id ? getVendorName(prompt.vendor_id) : 
                       <Chip label="Template" size="small" color="info" />}
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={`v${prompt.version}`} 
                        size="small" 
                        variant="outlined" 
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={prompt.is_active ? 'Active' : 'Inactive'}
                        color={prompt.is_active ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={prompt.is_template ? 'Template' : 'Regular'}
                        color={prompt.is_template ? 'info' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{formatDate(prompt.created_at)}</TableCell>
                    <TableCell>
                      <Tooltip title="View">
                        <IconButton 
                          size="small" 
                          onClick={() => {
                            setSelectedPrompt(prompt);
                            setViewDialogOpen(true);
                          }}
                        >
                          <ViewIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Edit">
                        <IconButton 
                          size="small"
                          onClick={() => handleEditPrompt(prompt)}
                        >
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Test">
                        <IconButton 
                          size="small"
                          onClick={() => handleTestPrompt(prompt)}
                        >
                          <TestIcon />
                        </IconButton>
                      </Tooltip>
                      
                      {!prompt.is_active && (
                        <Tooltip title="Activate">
                          <IconButton 
                            size="small" 
                            color="success"
                            onClick={() => handleActivatePrompt(prompt.id)}
                          >
                            <ActivateIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                      
                      <Tooltip title="Version History">
                        <IconButton 
                          size="small"
                          onClick={() => handleViewHistory(prompt)}
                        >
                          <HistoryIcon />
                        </IconButton>
                      </Tooltip>
                      
                      <Tooltip title="Delete">
                        <IconButton 
                          size="small" 
                          color="error"
                          onClick={() => handleDeletePrompt(prompt.id)}
                          disabled={prompt.is_active}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* Create/Edit Prompt Dialog */}
      <Dialog 
        open={createDialogOpen || editDialogOpen} 
        onClose={() => {
          setCreateDialogOpen(false);
          setEditDialogOpen(false);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          {selectedPrompt ? 'Edit Prompt' : 'Create New Prompt'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Prompt Name"
                  value={formData.prompt_name}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    prompt_name: e.target.value
                  }))}
                  fullWidth
                  required
                  disabled={formLoading}
                />
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <FormControl fullWidth>
                  <InputLabel>Vendor</InputLabel>
                  <Select
                    value={formData.vendor_id}
                    label="Vendor"
                    onChange={(e) => setFormData(prev => ({
                      ...prev,
                      vendor_id: e.target.value
                    }))}
                    disabled={formLoading}
                  >
                    <MenuItem value="">None (Template)</MenuItem>
                    {vendors.map((vendor) => (
                      <MenuItem key={vendor.id} value={vendor.id}>
                        {vendor.display_name || vendor.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              
              <Grid item xs={12}>
                <TextField
                  label="Prompt Text"
                  value={formData.prompt_text}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    prompt_text: e.target.value
                  }))}
                  fullWidth
                  multiline
                  rows={12}
                  required
                  disabled={formLoading}
                  helperText="Enter the complete prompt text for Claude AI invoice extraction"
                />
              </Grid>
              
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_template}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          is_template: e.target.checked
                        }))}
                        disabled={formLoading}
                      />
                    }
                    label="Template Prompt"
                  />
                  
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.is_active}
                        onChange={(e) => setFormData(prev => ({
                          ...prev,
                          is_active: e.target.checked
                        }))}
                        disabled={formLoading || formData.is_template}
                      />
                    }
                    label="Active Prompt"
                  />
                  
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={loadTemplatePrompt}
                    disabled={formLoading}
                  >
                    Load Template
                  </Button>
                </Box>
              </Grid>
              
              {formData.is_active && formData.vendor_id && (
                <Grid item xs={12}>
                  <Alert severity="warning">
                    Setting this as active will deactivate any other active prompts for this vendor.
                  </Alert>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => {
              setCreateDialogOpen(false);
              setEditDialogOpen(false);
            }}
            disabled={formLoading}
          >
            Cancel
          </Button>
          <Button 
            onClick={handleFormSubmit}
            variant="contained"
            disabled={formLoading || !formData.prompt_name || !formData.prompt_text}
          >
            {formLoading ? (
              <CircularProgress size={20} />
            ) : (
              selectedPrompt ? 'Update' : 'Create'
            )}
          </Button>
        </DialogActions>
      </Dialog>


      {/* Enhanced Test Prompt Dialog */}
      <Dialog 
        open={testDialogOpen} 
        onClose={() => setTestDialogOpen(false)}
        maxWidth={false}
        fullWidth
        PaperProps={{
          sx: { 
            width: '95vw', 
            height: '90vh',
            maxWidth: 'none',
            maxHeight: 'none'
          }
        }}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">
              Test Prompt: {selectedPrompt?.prompt_name}
            </Typography>
            <Box display="flex" alignItems="center" gap={2}>
              {testResults && (
                <Chip 
                  label={testResults.success ? 'Test Passed' : 'Test Failed'} 
                  color={testResults.success ? 'success' : 'error'}
                  size="small"
                />
              )}
            </Box>
          </Box>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0, height: '80vh' }}>
          {/* 2x2 Grid Layout for Better UX */}
          <Grid container sx={{ height: '100%' }}>
            
            {/* TOP ROW - Prompt and Text Phase */}
            
            {/* Top Left - Prompt Editor */}
            <Grid item xs={6} sx={{ 
              height: '50%', 
              borderRight: 1, 
              borderBottom: 1, 
              borderColor: 'divider',
              overflow: 'hidden'
            }}>
              <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'rgba(76, 175, 80, 0.02)' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">
                    ⚡ Prompt Editor
                  </Typography>
                  <Chip 
                    label="Step 1: Edit Prompt" 
                    color="primary"
                    size="small" 
                    variant="outlined"
                  />
                </Box>

                <TextField
                  fullWidth
                  multiline
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  disabled={testLoading}
                  placeholder="Edit your prompt here to fine-tune extraction results..."
                  minRows={1}
                  maxRows={Infinity}
                  sx={{ 
                    mb: 2,
                    flex: 1,
                    display: 'flex',
                    '& .MuiInputBase-root': {
                      height: '100%',
                      alignItems: 'flex-start'
                    },
                    '& .MuiInputBase-input': {
                      fontFamily: 'monospace',
                      fontSize: '0.875rem',
                      height: '100% !important',
                      overflow: 'auto !important',
                      resize: 'none'
                    },
                    '& .MuiOutlinedInput-root': {
                      height: '100%',
                      alignItems: 'flex-start'
                    },
                    '& textarea': {
                      height: '100% !important',
                      overflow: 'auto !important'
                    }
                  }}
                />
                
                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                  <Button
                    variant="outlined"
                    onClick={() => setPromptText(selectedPrompt?.prompt_text || '')}
                    disabled={testLoading}
                    size="small"
                  >
                    Reset to Original
                  </Button>
                  {testResults && (
                    <Chip 
                      label={testResults.success ? 'Last Test: Success' : 'Last Test: Failed'} 
                      color={testResults.success ? 'success' : 'error'}
                      size="small"
                    />
                  )}
                </Box>
              </Box>
            </Grid>

            {/* Top Right - Extracted Text Display */}
            <Grid item xs={6} sx={{ 
              height: '50%', 
              borderBottom: 1, 
              borderColor: 'divider',
              overflow: 'hidden'
            }}>
              <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">
                    📝 Extracted Text
                  </Typography>
                  <Box display="flex" gap={1}>
                    <Chip 
                      label="Step 2: Extract & Verify" 
                      color={testData.extractedContent ? "success" : uploadLoading ? "info" : "warning"}
                      size="small" 
                      variant={testData.extractedContent ? "filled" : "outlined"}
                      icon={testData.extractedContent ? <CheckIcon /> : null}
                    />
                    {testData.selectedFile && !testData.extractedContent && !uploadLoading && (
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleExtractText()}
                        disabled={uploadLoading}
                        startIcon={<TestIcon />}
                      >
                        Extract Text
                      </Button>
                    )}
                  </Box>
                </Box>

                {uploadLoading ? (
                  <Paper 
                    sx={{ 
                      flex: 1, 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.50',
                      flexDirection: 'column',
                      gap: 2
                    }}
                  >
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" align="center">
                      Extracting text from document...
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center">
                      This may take a few seconds for large files
                    </Typography>
                  </Paper>
                ) : testData.extractedContent ? (
                  <Paper 
                    sx={{ 
                      flex: 1, 
                      p: 2, 
                      overflow: 'auto',
                      bgcolor: 'grey.50',
                      fontFamily: 'monospace'
                    }}
                  >
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                      <Typography variant="caption" color="text.secondary">
                        Extracted Text ({testData.extractedContent.length} characters)
                      </Typography>
                      <Chip 
                        label="✅ Text Extracted" 
                        color="success" 
                        size="small" 
                      />
                    </Box>
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        whiteSpace: 'pre-wrap', 
                        fontSize: '0.75rem',
                        lineHeight: 1.4
                      }}
                    >
                      {testData.extractedContent.substring(0, 2000)}
                      {testData.extractedContent.length > 2000 && (
                        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block', mt: 1 }}>
                          ... ({testData.extractedContent.length - 2000} more characters)
                        </Typography>
                      )}
                    </Typography>
                  </Paper>
                ) : (
                  <Paper 
                    sx={{ 
                      flex: 1, 
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: 'grey.50',
                      flexDirection: 'column',
                      gap: 1
                    }}
                  >
                    <Typography variant="body1" color="text.secondary" align="center">
                      {testData.selectedFile ? 
                        '⏳ Ready for text extraction' : 
                        '📄 Upload a document first'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" align="center">
                      {testData.selectedFile ? 
                        'Text extraction will happen automatically, or click "Extract Text" manually' : 
                        'Choose a PDF or HTML file to begin'}
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Grid>

            {/* BOTTOM ROW - Document and Results Phase */}
            
            {/* Bottom Left - Document Preview */}
            <Grid item xs={6} sx={{ 
              height: '50%', 
              borderRight: 1, 
              borderColor: 'divider',
              overflow: 'hidden'
            }}>
              <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">
                    📄 Document Preview
                  </Typography>
                  <Chip 
                    label="Step 3: Upload & Preview" 
                    color={testData.selectedFile ? "success" : "default"}
                    size="small" 
                    variant={testData.selectedFile ? "filled" : "outlined"}
                    icon={testData.selectedFile ? <CheckIcon /> : null}
                  />
                </Box>

                {!testData.selectedFile ? (
                  <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <input
                      id="test-file-input"
                      type="file"
                      accept=".pdf,.html,.htm"
                      onChange={handleFileSelect}
                      style={{ display: 'none' }}
                      disabled={uploadLoading || testLoading}
                    />
                    <label htmlFor="test-file-input">
                      <Button
                        variant="outlined"
                        component="span"
                        disabled={uploadLoading || testLoading}
                        sx={{ 
                          borderStyle: 'dashed',
                          borderWidth: 2,
                          p: 4,
                          width: 300,
                          height: 180,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1
                        }}
                      >
                        <Typography variant="h4">📁</Typography>
                        <Typography variant="h6">Choose Invoice File</Typography>
                        <Typography variant="body2" color="text.secondary">
                          PDF or HTML (max 10MB)
                        </Typography>
                      </Button>
                    </label>
                  </Box>
                ) : (
                  <>
                    {/* File Info Header */}
                    <Card sx={{ mb: 2, bgcolor: 'rgba(46, 124, 228, 0.05)' }}>
                      <CardContent sx={{ py: 1.5 }}>
                        <Box display="flex" alignItems="center" gap={2}>
                          <Typography variant="h6">
                            {getFileIcon(testData.selectedFile.name)}
                          </Typography>
                          <Box flex={1}>
                            <Typography variant="body1" fontWeight={500}>
                              {testData.selectedFile.name}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {formatFileSize(testData.selectedFile.size)}
                            </Typography>
                          </Box>
                          <Chip 
                            label={testData.document_type.toUpperCase()} 
                            color="primary" 
                            size="small" 
                          />
                          <Button
                            size="small"
                            onClick={() => setTestData(prev => ({ 
                              ...prev, 
                              selectedFile: null, 
                              tempFileId: null,
                              extractedContent: null 
                            }))}
                          >
                            Change
                          </Button>
                        </Box>
                      </CardContent>
                    </Card>

                    {/* Large Document Viewer */}
                    {testData.tempFileId && (
                      <Box sx={{ flex: 1, minHeight: 0 }}>
                        <Box
                          component="iframe"
                          src={`http://localhost:5001/api/prompts/test-file/${testData.tempFileId}?token=${localStorage.getItem('token')}`}
                          sx={{
                            width: '100%',
                            height: '100%',
                            border: '1px solid #ddd',
                            borderRadius: 1,
                            bgcolor: 'white'
                          }}
                        />
                      </Box>
                    )}
                  </>
                )}

                {uploadLoading && (
                  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ mt: 1 }}>
                      Processing file...
                    </Typography>
                  </Box>
                )}
              </Box>
            </Grid>

            {/* Bottom Right - Extraction Results */}
            <Grid item xs={6} sx={{ 
              height: '50%', 
              overflow: 'auto'
            }}>
              <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                  <Typography variant="h6">
                    📊 Extraction Results
                  </Typography>
                  <Box display="flex" gap={1} alignItems="center">
                    <Chip 
                      label="Step 4: Test & Review" 
                      color={testResults?.success ? "success" : testLoading ? "info" : "default"}
                      size="small" 
                      variant={testResults?.success ? "filled" : "outlined"}
                      icon={testResults?.success ? <CheckIcon /> : null}
                      disabled={!testData.extractedContent}
                    />
                    <Button
                      variant="contained"
                      onClick={runPromptTest}
                      disabled={testLoading || !testData.extractedContent || uploadLoading}
                      startIcon={testLoading ? <CircularProgress size={16} /> : <TestIcon />}
                      color="success"
                      size="small"
                    >
                      {testLoading ? 'Testing...' : 'Run Test'}
                    </Button>
                  </Box>
                </Box>

                {testLoading ? (
                  <Box sx={{ 
                    flex: 1, 
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    gap: 2
                  }}>
                    <CircularProgress />
                    <Typography variant="body2" color="text.secondary" align="center">
                      Running prompt test...
                    </Typography>
                    <Typography variant="caption" color="text.secondary" align="center">
                      Processing with Claude AI
                    </Typography>
                  </Box>
                ) : testResults?.extracted_data ? (
                  <Box sx={{ flex: 1, overflow: 'auto' }}>
                    {/* Invoice Header */}
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      Invoice Information
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ mb: 2, maxHeight: 140 }}>
                      <Table size="small">
                        <TableBody>
                          {Object.entries(testResults.extracted_data.invoice_header || {}).map(([key, value]) => (
                            <TableRow key={key}>
                              <TableCell sx={{ fontWeight: 500, width: '50%' }}>
                                {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                              </TableCell>
                              <TableCell>
                                {typeof value === 'number' && key.includes('amount') ? 
                                  formatCurrency(value) : 
                                  (value || 'N/A')}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {/* Line Items */}
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      Line Items ({testResults.extracted_data.line_items?.length || 0})
                    </Typography>
                    <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 200 }}>
                      <Table size="small" stickyHeader>
                        <TableHead>
                          <TableRow>
                            <TableCell>Description</TableCell>
                            <TableCell align="right">Qty</TableCell>
                            <TableCell align="right">Price</TableCell>
                            <TableCell align="right">Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(testResults.extracted_data.line_items || []).map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.description || 'N/A'}</TableCell>
                              <TableCell align="right">{item.quantity || 0}</TableCell>
                              <TableCell align="right">{formatCurrency(item.unit_price)}</TableCell>
                              <TableCell align="right">{formatCurrency(item.total_amount)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Box>
                ) : (
                  <Paper 
                    sx={{ 
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      gap: 2,
                      bgcolor: 'grey.50'
                    }}
                  >
                    <Typography variant="body1" color="text.secondary">
                      {!testData.extractedContent ? 
                        '📝 Extract text first, then edit your prompt' :
                        '🚀 Click "Run Test" to see extraction results'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Results will appear here after testing your prompt
                    </Typography>
                  </Paper>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setTestDialogOpen(false)} disabled={testLoading}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* View Prompt Dialog */}
      <Dialog 
        open={viewDialogOpen} 
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          View Prompt: {selectedPrompt?.prompt_name}
          <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <Chip 
              label={`v${selectedPrompt?.version}`} 
              size="small" 
              variant="outlined" 
            />
            <Chip
              label={selectedPrompt?.is_active ? 'Active' : 'Inactive'}
              color={selectedPrompt?.is_active ? 'success' : 'default'}
              size="small"
            />
            <Chip
              label={selectedPrompt?.is_template ? 'Template' : 'Regular'}
              color={selectedPrompt?.is_template ? 'info' : 'default'}
              size="small"
            />
          </Box>
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Vendor
                </Typography>
                <Typography variant="body1">
                  {selectedPrompt?.vendor_id ? 
                   getVendorName(selectedPrompt.vendor_id) : 
                   'No vendor (Template)'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Created
                </Typography>
                <Typography variant="body1">
                  {selectedPrompt?.created_at ? formatDate(selectedPrompt.created_at) : 'N/A'}
                </Typography>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Created By
                </Typography>
                <Typography variant="body1">
                  {selectedPrompt?.created_by || 'Unknown'}
                </Typography>
              </Grid>
              
              {selectedPrompt?.parent_prompt_id && (
                <Grid item xs={12} sm={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Parent Prompt
                  </Typography>
                  <Typography variant="body1">
                    Version {selectedPrompt.version - 1}
                  </Typography>
                </Grid>
              )}
              
              <Grid item xs={12}>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                  Prompt Text
                </Typography>
                <Paper 
                  sx={{ 
                    p: 2, 
                    bgcolor: 'grey.50', 
                    maxHeight: 400, 
                    overflow: 'auto',
                    fontFamily: 'monospace'
                  }}
                >
                  <Typography 
                    variant="body2" 
                    sx={{ whiteSpace: 'pre-wrap', fontSize: '0.875rem' }}
                  >
                    {selectedPrompt?.prompt_text}
                  </Typography>
                </Paper>
              </Grid>
              
              {selectedPrompt?.test_results && (
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    Test Results
                  </Typography>
                  <Typography variant="body2">
                    {Array.isArray(selectedPrompt.test_results) ? 
                     `${selectedPrompt.test_results.length} test(s) performed` :
                     'No test results available'}
                  </Typography>
                </Grid>
              )}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => handleEditPrompt(selectedPrompt)}
            variant="outlined"
          >
            Edit
          </Button>
          <Button onClick={() => setViewDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Version History Dialog */}
      <Dialog 
        open={historyDialogOpen} 
        onClose={() => setHistoryDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Version History: {selectedPrompt?.prompt_name}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            {historyLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : historyVersions.length === 0 ? (
              <Typography color="text.secondary" align="center">
                No version history available
              </Typography>
            ) : (
              <TableContainer component={Paper}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Version</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Vendor</TableCell>
                      <TableCell>Created</TableCell>
                      <TableCell>Created By</TableCell>
                      <TableCell>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historyVersions.map((version) => (
                      <TableRow key={version.id} hover>
                        <TableCell>
                          <Chip 
                            label={`v${version.version}`} 
                            size="small" 
                            variant="outlined" 
                          />
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={version.is_active ? 'Active' : 'Inactive'}
                            color={version.is_active ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {version.vendor_id ? 
                           getVendorName(version.vendor_id) : 
                           <Chip label="Template" size="small" color="info" />}
                        </TableCell>
                        <TableCell>{formatDate(version.created_at)}</TableCell>
                        <TableCell>{version.created_by || 'Unknown'}</TableCell>
                        <TableCell>
                          <Tooltip title="View">
                            <IconButton 
                              size="small"
                              onClick={() => {
                                setSelectedPrompt(version);
                                setViewDialogOpen(true);
                                setHistoryDialogOpen(false);
                              }}
                            >
                              <ViewIcon />
                            </IconButton>
                          </Tooltip>
                          
                          {!version.is_active && (
                            <Tooltip title="Activate">
                              <IconButton 
                                size="small" 
                                color="success"
                                onClick={() => {
                                  handleActivatePrompt(version.id);
                                  setHistoryDialogOpen(false);
                                }}
                              >
                                <ActivateIcon />
                              </IconButton>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryDialogOpen(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PromptsPage;