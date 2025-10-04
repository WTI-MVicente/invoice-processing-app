import { createTheme } from '@mui/material/styles';

// Waterfield Tech brand colors from branding guide
export const brandColors = {
  primaryBlue: '#1B4B8C',
  accentBlue: '#2E7CE4',
  white: '#FFFFFF',
  darkGray: '#2C3E50',
  lightGray: '#F8F9FA',
  mediumGray: '#6C757D',
  successGreen: '#28A745',
  warningOrange: '#FD7E14',
  techGradient: 'linear-gradient(135deg, #1B4B8C 0%, #2E7CE4 100%)'
};

export const theme = createTheme({
  palette: {
    primary: {
      main: brandColors.primaryBlue,
      light: brandColors.accentBlue,
      dark: '#0F2A4C',
      contrastText: brandColors.white,
    },
    secondary: {
      main: brandColors.accentBlue,
      light: '#5A9BE8',
      dark: '#1E5BB8',
      contrastText: brandColors.white,
    },
    success: {
      main: brandColors.successGreen,
      light: '#5CB85C',
      dark: '#1E7E34',
    },
    warning: {
      main: brandColors.warningOrange,
      light: '#FF9147',
      dark: '#E55A00',
    },
    background: {
      default: brandColors.lightGray,
      paper: brandColors.white,
    },
    text: {
      primary: brandColors.darkGray,
      secondary: brandColors.mediumGray,
    },
    grey: {
      50: '#FAFBFC',
      100: brandColors.lightGray,
      200: '#E9ECEF',
      300: '#DEE2E6',
      400: '#CED4DA',
      500: brandColors.mediumGray,
      600: '#5A6268',
      700: '#495057',
      800: '#343A40',
      900: '#212529',
    }
  },
  typography: {
    fontFamily: "'Inter', 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif",
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600,
      color: brandColors.primaryBlue,
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600,
      color: brandColors.primaryBlue,
    },
    h3: {
      fontSize: '1.5rem',
      fontWeight: 600,
      color: brandColors.primaryBlue,
    },
    h4: {
      fontSize: '1.25rem',
      fontWeight: 500,
      color: brandColors.primaryBlue,
    },
    h5: {
      fontSize: '1.125rem',
      fontWeight: 500,
      color: brandColors.primaryBlue,
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 500,
      color: brandColors.primaryBlue,
    },
    body1: {
      fontSize: '1rem',
      fontWeight: 400,
      color: brandColors.darkGray,
    },
    body2: {
      fontSize: '0.875rem',
      fontWeight: 400,
      color: brandColors.mediumGray,
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 500,
      textTransform: 'none',
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundImage: 'linear-gradient(135deg, rgba(27, 75, 140, 0.02) 0%, rgba(46, 124, 228, 0.02) 100%)',
          minHeight: '100vh',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 500,
          padding: '12px 24px',
        },
        containedPrimary: {
          background: brandColors.techGradient,
          boxShadow: '0 4px 15px rgba(27, 75, 140, 0.3)',
          '&:hover': {
            background: 'linear-gradient(135deg, #0F2A4C 0%, #1E5BB8 100%)',
            boxShadow: '0 6px 20px rgba(27, 75, 140, 0.4)',
          },
        },
        outlined: {
          borderColor: 'rgba(27, 75, 140, 0.2)',
          color: brandColors.primaryBlue,
          '&:hover': {
            borderColor: brandColors.primaryBlue,
            backgroundColor: 'rgba(27, 75, 140, 0.04)',
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(27, 75, 140, 0.1)',
          borderRadius: 16,
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.08)',
        },
      },
    },
    MuiTextField: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            background: 'rgba(255, 255, 255, 0.8)',
            backdropFilter: 'blur(10px)',
            '& fieldset': {
              borderColor: 'rgba(27, 75, 140, 0.2)',
            },
            '&:hover fieldset': {
              borderColor: 'rgba(27, 75, 140, 0.4)',
            },
            '&.Mui-focused fieldset': {
              borderColor: brandColors.primaryBlue,
            },
          },
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        outlined: {
          background: 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(10px)',
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 16,
        },
        colorSuccess: {
          background: 'rgba(40, 167, 69, 0.15)',
          color: brandColors.successGreen,
          border: '1px solid rgba(40, 167, 69, 0.3)',
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 600,
          color: brandColors.primaryBlue,
          borderBottom: '2px solid rgba(27, 75, 140, 0.2)',
        },
        body: {
          borderBottom: '1px solid rgba(27, 75, 140, 0.1)',
        },
      },
    },
  },
});