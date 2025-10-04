import React from 'react';
import { Typography, Paper, Box } from '@mui/material';

const ImportPage = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Import Invoices
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Import invoices functionality will be implemented here.
          This will include vendor selection, file upload, and batch processing.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ImportPage;