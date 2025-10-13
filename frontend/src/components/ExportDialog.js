import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Tabs,
  Tab,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Grid,
  Card,
  CardContent,
  Chip,
  Alert,
  LinearProgress,
  FormControlLabel,
  Checkbox,
  IconButton,
  Tooltip,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Download,
  FileText,
  Table,
  Settings,
  Save,
  Trash2,
  Eye,
  CheckCircle,
  AlertTriangle,
  X,
  Plus,
} from 'lucide-react';
import Select as ReactSelect from 'react-select';
import { saveAs } from 'file-saver';
import axios from 'axios';

const TabPanel = ({ children, value, index, ...other }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`export-tabpanel-${index}`}
    aria-labelledby={`export-tab-${index}`}
    {...other}
  >
    {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
  </div>
);

const ExportDialog = ({ open, onClose, appliedFilters = {} }) => {
  // State management
  const [activeTab, setActiveTab] = useState(0);
  const [exportFormat, setExportFormat] = useState('xlsx');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  
  // Template management
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [templateDescription, setTemplateDescription] = useState('');
  const [isPublicTemplate, setIsPublicTemplate] = useState(false);
  
  // Field selection
  const [availableFields, setAvailableFields] = useState({ invoice: [], line_item: [] });
  const [selectedInvoiceFields, setSelectedInvoiceFields] = useState([]);
  const [selectedLineItemFields, setSelectedLineItemFields] = useState([]);
  
  // UI states
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showTemplateForm, setShowTemplateForm] = useState(false);

  // Load initial data
  useEffect(() => {
    if (open) {
      loadTemplates();
      loadAvailableFields();
      setError('');
      setSuccess('');
    }
  }, [open]);

  // Load templates from backend
  const loadTemplates = async () => {
    try {
      const response = await axios.get('/api/exports/templates');
      if (response.data.success) {
        setTemplates(response.data.templates);
        
        // Auto-select first template if none selected
        if (response.data.templates.length > 0 && !selectedTemplate) {
          const firstTemplate = response.data.templates[0];
          setSelectedTemplate(firstTemplate.id);
          loadTemplate(firstTemplate);
        }
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
      setError('Failed to load export templates');
    }
  };

  // Load available field definitions
  const loadAvailableFields = async () => {
    try {
      const response = await axios.get('/api/exports/fields');
      if (response.data.success) {
        setAvailableFields(response.data.fields);
      }
    } catch (error) {
      console.error('Failed to load available fields:', error);
      setError('Failed to load field definitions');
    }
  };

  // Load template configuration
  const loadTemplate = (template) => {
    setSelectedInvoiceFields(template.invoice_fields || []);
    setSelectedLineItemFields(template.line_item_fields || []);
    setTemplateName(template.name || '');
    setTemplateDescription(template.description || '');
    setIsPublicTemplate(template.is_public || false);
  };

  // Handle template selection change
  const handleTemplateChange = (templateId) => {
    setSelectedTemplate(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      loadTemplate(template);
    }
  };

  // Convert fields for react-select
  const formatFieldsForSelect = (fields) => 
    fields.map(field => ({
      value: field.key,
      label: field.label,
      data: field
    }));

  // Handle field selection changes
  const handleInvoiceFieldsChange = (selectedOptions) => {
    const fields = selectedOptions.map(option => option.data);
    setSelectedInvoiceFields(fields);
  };

  const handleLineItemFieldsChange = (selectedOptions) => {
    const fields = selectedOptions.map(option => option.data);
    setSelectedLineItemFields(fields);
  };

  // Save current configuration as new template
  const handleSaveTemplate = async () => {
    try {
      if (!templateName.trim()) {
        setError('Template name is required');
        return;
      }

      if (selectedInvoiceFields.length === 0 || selectedLineItemFields.length === 0) {
        setError('Both invoice and line item fields are required');
        return;
      }

      const templateData = {
        name: templateName,
        description: templateDescription,
        invoice_fields: selectedInvoiceFields,
        line_item_fields: selectedLineItemFields,
        is_public: isPublicTemplate
      };

      const response = await axios.post('/api/exports/templates', templateData);
      
      if (response.data.success) {
        setSuccess('Template saved successfully');
        setShowTemplateForm(false);
        loadTemplates();
        setSelectedTemplate(response.data.template.id);
      }
    } catch (error) {
      console.error('Failed to save template:', error);
      setError('Failed to save template');
    }
  };

  // Delete selected template
  const handleDeleteTemplate = async () => {
    if (!selectedTemplate) return;
    
    try {
      await axios.delete(`/api/exports/templates/${selectedTemplate}`);
      setSuccess('Template deleted successfully');
      loadTemplates();
      setSelectedTemplate('');
      setSelectedInvoiceFields([]);
      setSelectedLineItemFields([]);
    } catch (error) {
      console.error('Failed to delete template:', error);
      setError('Failed to delete template');
    }
  };

  // Generate and download export
  const handleExport = async () => {
    try {
      if (!selectedTemplate) {
        setError('Please select a template');
        return;
      }

      setIsExporting(true);
      setExportProgress('Preparing export...');
      setError('');

      const exportData = {
        template_id: selectedTemplate,
        filters: appliedFilters,
        format: exportFormat
      };

      setExportProgress(`Generating ${exportFormat.toUpperCase()} export...`);

      const response = await axios.post('/api/exports/generate', exportData, {
        responseType: 'blob'
      });

      // Create filename
      const template = templates.find(t => t.id === selectedTemplate);
      const timestamp = new Date().toISOString().split('T')[0];
      const filename = `${template?.name.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}.${exportFormat === 'xlsx' ? 'xlsx' : 'zip'}`;

      // Download file
      setExportProgress('Download ready!');
      saveAs(response.data, filename);
      
      setSuccess(`Export completed: ${filename}`);
      setTimeout(() => {
        onClose();
      }, 2000);

    } catch (error) {
      console.error('Export failed:', error);
      setError(error.response?.data?.error || 'Export generation failed');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  };

  // Calculate export preview
  const getExportPreview = () => {
    const invoiceFieldCount = selectedInvoiceFields.length;
    const lineItemFieldCount = selectedLineItemFields.length;
    const format = exportFormat === 'xlsx' ? 'Excel workbook with 2 sheets' : 'ZIP archive with 2 CSV files';
    
    return {
      format,
      invoiceFieldCount,
      lineItemFieldCount,
      totalFields: invoiceFieldCount + lineItemFieldCount
    };
  };

  const preview = getExportPreview();

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth={false}
      fullWidth
      PaperProps={{
        sx: { 
          width: '95vw', 
          height: '90vh',
          maxWidth: 'none'
        }
      }}
    >
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Box display="flex" alignItems="center" gap={2}>
            <Download size={24} />
            <Typography variant="h5">Export Invoice Data</Typography>
          </Box>
          <IconButton onClick={onClose}>
            <X size={20} />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        {/* Error/Success Messages */}
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

        <Grid container spacing={3}>
          {/* Left Panel - Configuration */}
          <Grid item xs={12} md={8}>
            {/* Template and Format Selection */}
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Export Configuration</Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Export Template</InputLabel>
                    <Select
                      value={selectedTemplate}
                      label="Export Template"
                      onChange={(e) => handleTemplateChange(e.target.value)}
                    >
                      {templates.map(template => (
                        <MenuItem key={template.id} value={template.id}>
                          <Box>
                            <Typography variant="body1">{template.name}</Typography>
                            {template.description && (
                              <Typography variant="caption" color="text.secondary">
                                {template.description}
                              </Typography>
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Format</InputLabel>
                    <Select
                      value={exportFormat}
                      label="Format"
                      onChange={(e) => setExportFormat(e.target.value)}
                    >
                      <MenuItem value="xlsx">
                        <Box display="flex" alignItems="center" gap={1}>
                          <Table size={16} />
                          Excel (XLSX)
                        </Box>
                      </MenuItem>
                      <MenuItem value="csv">
                        <Box display="flex" alignItems="center" gap={1}>
                          <FileText size={16} />
                          CSV (ZIP)
                        </Box>
                      </MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Box display="flex" gap={1}>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<Plus size={16} />}
                      onClick={() => setShowTemplateForm(!showTemplateForm)}
                      sx={{ height: '56px' }}
                    >
                      New Template
                    </Button>
                    {selectedTemplate && (
                      <Button
                        variant="outlined"
                        size="small"
                        color="error"
                        startIcon={<Trash2 size={16} />}
                        onClick={handleDeleteTemplate}
                        sx={{ height: '56px' }}
                      >
                        Delete
                      </Button>
                    )}
                  </Box>
                </Grid>
              </Grid>

              {/* Template Creation Form */}
              {showTemplateForm && (
                <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                  <Typography variant="subtitle1" sx={{ mb: 2 }}>Create New Template</Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Template Name"
                        value={templateName}
                        onChange={(e) => setTemplateName(e.target.value)}
                        required
                      />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        label="Description (Optional)"
                        value={templateDescription}
                        onChange={(e) => setTemplateDescription(e.target.value)}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Checkbox
                            checked={isPublicTemplate}
                            onChange={(e) => setIsPublicTemplate(e.target.checked)}
                          />
                        }
                        label="Make this template available to all users"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <Box display="flex" gap={2}>
                        <Button
                          variant="contained"
                          startIcon={<Save size={16} />}
                          onClick={handleSaveTemplate}
                          size="small"
                        >
                          Save Template
                        </Button>
                        <Button
                          variant="outlined"
                          onClick={() => setShowTemplateForm(false)}
                          size="small"
                        >
                          Cancel
                        </Button>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </Paper>

            {/* Field Selection Tabs */}
            <Paper sx={{ p: 3 }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Tabs 
                  value={activeTab} 
                  onChange={(e, newValue) => setActiveTab(newValue)}
                  aria-label="export field tabs"
                >
                  <Tab 
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <FileText size={16} />
                        Invoice Fields ({selectedInvoiceFields.length})
                      </Box>
                    } 
                  />
                  <Tab 
                    label={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Table size={16} />
                        Line Item Fields ({selectedLineItemFields.length})
                      </Box>
                    } 
                  />
                </Tabs>
              </Box>

              {/* Invoice Fields Tab */}
              <TabPanel value={activeTab} index={0}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Select Invoice-Level Fields to Export
                </Typography>
                <ReactSelect
                  isMulti
                  value={formatFieldsForSelect(selectedInvoiceFields)}
                  onChange={handleInvoiceFieldsChange}
                  options={formatFieldsForSelect(availableFields.invoice)}
                  placeholder="Select invoice fields..."
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {selectedInvoiceFields.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Selected Fields:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {selectedInvoiceFields.map(field => (
                        <Chip 
                          key={field.key} 
                          label={field.label}
                          size="small"
                          color={field.required ? "primary" : "default"}
                          variant={field.required ? "filled" : "outlined"}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </TabPanel>

              {/* Line Item Fields Tab */}
              <TabPanel value={activeTab} index={1}>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Select Line Item-Level Fields to Export
                </Typography>
                <ReactSelect
                  isMulti
                  value={formatFieldsForSelect(selectedLineItemFields)}
                  onChange={handleLineItemFieldsChange}
                  options={formatFieldsForSelect(availableFields.line_item)}
                  placeholder="Select line item fields..."
                  className="react-select-container"
                  classNamePrefix="react-select"
                />
                {selectedLineItemFields.length > 0 && (
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      Selected Fields:
                    </Typography>
                    <Box display="flex" flexWrap="wrap" gap={1}>
                      {selectedLineItemFields.map(field => (
                        <Chip 
                          key={field.key} 
                          label={field.label}
                          size="small"
                          color={field.required ? "primary" : "default"}
                          variant={field.required ? "filled" : "outlined"}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </TabPanel>
            </Paper>
          </Grid>

          {/* Right Panel - Preview */}
          <Grid item xs={12} md={4}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ mb: 2 }}>Export Preview</Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Format</Typography>
                  <Typography variant="body1">{preview.format}</Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Invoice Fields</Typography>
                  <Typography variant="body1">{preview.invoiceFieldCount} fields selected</Typography>
                </Box>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Line Item Fields</Typography>
                  <Typography variant="body1">{preview.lineItemFieldCount} fields selected</Typography>
                </Box>

                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary">Applied Filters</Typography>
                  {Object.keys(appliedFilters).length > 0 ? (
                    <Box>
                      {appliedFilters.search && (
                        <Chip label={`Search: "${appliedFilters.search}"`} size="small" sx={{ m: 0.5 }} />
                      )}
                      {appliedFilters.status && (
                        <Chip label={`Status: ${appliedFilters.status}`} size="small" sx={{ m: 0.5 }} />
                      )}
                      {appliedFilters.vendor && (
                        <Chip label={`Vendor: ${appliedFilters.vendor}`} size="small" sx={{ m: 0.5 }} />
                      )}
                      {appliedFilters.batch_name && (
                        <Chip label={`Batch: ${appliedFilters.batch_name}`} size="small" sx={{ m: 0.5 }} />
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2">No filters applied - all data will be exported</Typography>
                  )}
                </Box>

                {preview.invoiceFieldCount > 0 && preview.lineItemFieldCount > 0 && (
                  <Alert severity="info" icon={<CheckCircle size={16} />}>
                    Ready to export! This will create {exportFormat === 'xlsx' ? 'a multi-sheet Excel file' : 'a ZIP archive with 2 CSV files'}.
                  </Alert>
                )}

                {(preview.invoiceFieldCount === 0 || preview.lineItemFieldCount === 0) && (
                  <Alert severity="warning" icon={<AlertTriangle size={16} />}>
                    Please select fields for both invoices and line items to proceed.
                  </Alert>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ p: 3, gap: 2 }}>
        <Button onClick={onClose} variant="outlined">
          Cancel
        </Button>
        <Button
          onClick={handleExport}
          variant="contained"
          startIcon={<Download size={16} />}
          disabled={
            isExporting || 
            selectedInvoiceFields.length === 0 || 
            selectedLineItemFields.length === 0 ||
            !selectedTemplate
          }
        >
          {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
        </Button>
      </DialogActions>

      {/* Loading Progress */}
      {isExporting && (
        <Box sx={{ px: 3, pb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {exportProgress}
          </Typography>
        </Box>
      )}
    </Dialog>
  );
};

export default ExportDialog;