import React from 'react';
import { Typography, Paper, Box } from '@mui/material';

const PromptsPage = () => {
  return (
    <Box>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Extraction Prompts
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="body1" color="text.secondary">
          Prompt management interface will be implemented here.
          This will include prompt editing, testing, and version control.
        </Typography>
      </Paper>
    </Box>
  );
};

export default PromptsPage;