import React from 'react';
import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';

/**
 * TableSkeleton Component
 *
 * Loading skeleton for table views
 *
 * @param {number} rows - Number of skeleton rows to display (default: 5)
 * @param {number} columns - Number of columns (default: 5)
 */
export default function TableSkeleton({ rows = 5, columns = 5 }) {
  return (
    <TableContainer>
      <Table>
        <TableHead>
          <TableRow>
            {Array.from({ length: columns }).map((_, index) => (
              <TableCell key={`header-${index}`}>
                <Skeleton variant="text" width="80%" height={24} />
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <TableRow key={`row-${rowIndex}`}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <TableCell key={`cell-${rowIndex}-${colIndex}`}>
                  <Skeleton
                    variant="text"
                    width={colIndex === 0 ? '60%' : '90%'}
                    height={20}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
