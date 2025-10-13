import React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Grid,
} from '@mui/material';
import { GripVertical, ArrowRight } from 'lucide-react';

// Draggable field item
const DraggableField = ({ field, isSelected = false }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: field.key,
    data: { field, isSelected }
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <Box
      ref={setNodeRef}
      style={style}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        mb: 0.5,
        bgcolor: isDragging ? 'action.hover' : 'background.paper',
        borderRadius: 1,
        border: '1px solid',
        borderColor: isDragging ? 'primary.main' : 'divider',
        cursor: 'grab',
        '&:hover': {
          bgcolor: 'action.hover',
          borderColor: 'primary.light',
        },
        '&:active': {
          cursor: 'grabbing',
        }
      }}
      {...attributes}
      {...listeners}
    >
      <GripVertical size={16} color="gray" />
      <Chip
        label={field.label}
        size="small"
        color={field.required ? "primary" : "default"}
        variant={field.required ? "filled" : "outlined"}
        sx={{ 
          flex: 1,
          '& .MuiChip-label': {
            display: 'block',
            textAlign: 'left'
          }
        }}
      />
    </Box>
  );
};

// Droppable container for field lists
const DroppableFieldContainer = ({ 
  id, 
  children, 
  title, 
  subtitle,
  isEmpty = false 
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <Paper
      ref={setNodeRef}
      sx={{
        p: 2,
        height: '400px',
        display: 'flex',
        flexDirection: 'column',
        bgcolor: isOver ? 'action.hover' : 'background.paper',
        border: '2px solid',
        borderColor: isOver ? 'primary.main' : 'divider',
        borderStyle: isOver ? 'dashed' : 'solid',
      }}
    >
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {subtitle}
      </Typography>
      
      <Box sx={{ 
        flex: 1, 
        overflowY: 'auto',
        minHeight: '200px'
      }}>
        {isEmpty ? (
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column',
            alignItems: 'center', 
            justifyContent: 'center',
            height: '100%',
            color: 'text.secondary',
            textAlign: 'center'
          }}>
            <ArrowRight size={32} opacity={0.3} />
            <Typography variant="body2" sx={{ mt: 1 }}>
              Drag fields here to add them to your export
            </Typography>
          </Box>
        ) : (
          children
        )}
      </Box>
    </Paper>
  );
};

// Main dual-pane field selector component
const DualPaneFieldSelector = ({ 
  availableFields = [], 
  selectedFields = [], 
  onFieldsChange,
  fieldType = "Fields"
}) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter available fields to exclude already selected ones
  const unselectedFields = availableFields.filter(
    field => !selectedFields.find(selected => selected.key === field.key)
  );

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeField = active.data.current?.field;
    const isActiveSelected = active.data.current?.isSelected;
    
    if (!activeField) return;

    // Dragging from available to selected
    if (!isActiveSelected && over.id === 'selected') {
      const newSelectedFields = [...selectedFields, activeField];
      onFieldsChange(newSelectedFields);
    }
    
    // Dragging from selected back to available
    else if (isActiveSelected && over.id === 'available') {
      if (!activeField.required) { // Don't allow removing required fields
        const newSelectedFields = selectedFields.filter(
          field => field.key !== activeField.key
        );
        onFieldsChange(newSelectedFields);
      }
    }
    
    // Reordering within selected fields
    else if (isActiveSelected && over.id !== 'available') {
      const activeIndex = selectedFields.findIndex(field => field.key === active.id);
      const overIndex = selectedFields.findIndex(field => field.key === over.id);
      
      if (activeIndex !== -1 && overIndex !== -1) {
        const newSelectedFields = arrayMove(selectedFields, activeIndex, overIndex);
        onFieldsChange(newSelectedFields);
      }
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <Grid container spacing={3}>
        {/* Available Fields (Left Pane) */}
        <Grid item xs={12} md={6}>
          <DroppableFieldContainer
            id="available"
            title="Available Fields"
            subtitle={`Drag fields to the right to include in export (${unselectedFields.length} available)`}
          >
            <SortableContext
              items={unselectedFields.map(field => field.key)}
              strategy={verticalListSortingStrategy}
            >
              {unselectedFields.map(field => (
                <DraggableField
                  key={field.key}
                  field={field}
                  isSelected={false}
                />
              ))}
            </SortableContext>
          </DroppableFieldContainer>
        </Grid>

        {/* Selected Fields (Right Pane) */}
        <Grid item xs={12} md={6}>
          <DroppableFieldContainer
            id="selected"
            title="Export Fields"
            subtitle={`Order determines column order in export (${selectedFields.length} selected)`}
            isEmpty={selectedFields.length === 0}
          >
            {selectedFields.length > 0 && (
              <SortableContext
                items={selectedFields.map(field => field.key)}
                strategy={verticalListSortingStrategy}
              >
                <Box sx={{ pl: 4 }}> {/* Increased padding to prevent cutoff */}
                  {selectedFields.map((field, index) => (
                    <Box key={field.key} sx={{ position: 'relative' }}>
                      {/* Column number indicator */}
                      <Box sx={{
                        position: 'absolute',
                        left: -32,
                        top: '50%',
                        transform: 'translateY(-50%)',
                        bgcolor: 'primary.main',
                        color: 'white',
                        borderRadius: '50%',
                        width: 24,
                        height: 24,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.75rem',
                        fontWeight: 'bold',
                        zIndex: 1
                      }}>
                        {index + 1}
                      </Box>
                      <DraggableField
                        field={field}
                        isSelected={true}
                      />
                    </Box>
                  ))}
                </Box>
              </SortableContext>
            )}
          </DroppableFieldContainer>
        </Grid>
      </Grid>

      {/* Instructions */}
      <Box sx={{ mt: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          💡 <strong>Drag</strong> fields between panels • <strong>Reorder</strong> fields in the right panel for column order
          {selectedFields.some(f => f.required) && " • Required fields cannot be removed"}
        </Typography>
      </Box>
    </DndContext>
  );
};

export default DualPaneFieldSelector;