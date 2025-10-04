import React from 'react';
import { Typography, Paper, Box } from '@mui/material';

const ExportPage = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Export AR Package
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Export functionality will be implemented here.
          This will include filtering, selection, and AR package generation.
        </Typography>
      </Paper>
    </Box>
  );
};

export default ExportPage;