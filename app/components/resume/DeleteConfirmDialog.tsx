import React from 'react';

interface DeleteConfirmDialogProps {
  show: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Delete Confirmation Dialog Component
 * Displays a modal to confirm resume deletion
 */
const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  show,
  onConfirm,
  onCancel
}) => {
  if (!show) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-auto shadow-xl border border-gray-100 dark:border-gray-700">
        <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Delete Saved Resume?</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Are you sure you want to delete your saved resume? This action cannot be undone.
        </p>
        <div className="flex justify-end space-x-4">
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteConfirmDialog; 