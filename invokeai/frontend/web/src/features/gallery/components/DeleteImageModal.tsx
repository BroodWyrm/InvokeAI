import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  forwardRef,
  Flex,
  Text,
  useDisclosure,
} from '@chakra-ui/react';
import { createSelector } from '@reduxjs/toolkit';
import * as InvokeAI from 'app/invokeai';
import { deleteImage } from 'app/socketio/actions';
import { useAppDispatch, useAppSelector } from 'app/storeHooks';
import IAIButton from 'common/components/IAIButton';
import IAISwitch from 'common/components/IAISwitch';
import { systemSelector } from 'features/system/store/systemSelectors';
import {
  setShouldConfirmOnDelete,
  SystemState,
} from 'features/system/store/systemSlice';
import { isEqual } from 'lodash';

import {
  ChangeEvent,
  cloneElement,
  ReactElement,
  SyntheticEvent,
  useRef,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

const deleteImageModalSelector = createSelector(
  systemSelector,
  (system: SystemState) => {
    const { shouldConfirmOnDelete, isConnected, isProcessing } = system;
    return { shouldConfirmOnDelete, isConnected, isProcessing };
  },
  {
    memoizeOptions: {
      resultEqualityCheck: isEqual,
    },
  }
);
interface DeleteImageModalProps {
  /**
   *  Component which, on click, should delete the image/open the modal.
   */
  children: ReactElement;
  /**
   * The image to delete.
   */
  image?: InvokeAI._Image;
}

/**
 * Needs a child, which will act as the button to delete an image.
 * If system.shouldConfirmOnDelete is true, a confirmation modal is displayed.
 * If it is false, the image is deleted immediately.
 * The confirmation modal has a "Don't ask me again" switch to set the boolean.
 */
const DeleteImageModal = forwardRef(
  ({ image, children }: DeleteImageModalProps, ref) => {
    const { isOpen, onOpen, onClose } = useDisclosure();
    const dispatch = useAppDispatch();
    const { shouldConfirmOnDelete, isConnected, isProcessing } = useAppSelector(
      deleteImageModalSelector
    );
    const cancelRef = useRef<HTMLButtonElement>(null);

    const handleClickDelete = (e: SyntheticEvent) => {
      e.stopPropagation();
      shouldConfirmOnDelete ? onOpen() : handleDelete();
    };

    const handleDelete = () => {
      if (isConnected && !isProcessing && image) {
        dispatch(deleteImage(image));
      }
      onClose();
    };

    useHotkeys(
      'delete',
      () => {
        shouldConfirmOnDelete ? onOpen() : handleDelete();
      },
      [image, shouldConfirmOnDelete, isConnected, isProcessing]
    );

    const handleChangeShouldConfirmOnDelete = (
      e: ChangeEvent<HTMLInputElement>
    ) => dispatch(setShouldConfirmOnDelete(!e.target.checked));

    return (
      <>
        {cloneElement(children, {
          // TODO: This feels wrong.
          onClick: image ? handleClickDelete : undefined,
          ref: ref,
        })}

        <AlertDialog
          isOpen={isOpen}
          leastDestructiveRef={cancelRef}
          onClose={onClose}
        >
          <AlertDialogOverlay>
            <AlertDialogContent>
              <AlertDialogHeader fontSize="lg" fontWeight="bold">
                Delete image
              </AlertDialogHeader>

              <AlertDialogBody>
                <Flex direction="column" gap={5}>
                  <Text>
                    Are you sure? Deleted images will be sent to the Bin. You
                    can restore from there if you wish to.
                  </Text>
                  <IAISwitch
                    label="Don't ask me again"
                    isChecked={!shouldConfirmOnDelete}
                    onChange={handleChangeShouldConfirmOnDelete}
                  />
                </Flex>
              </AlertDialogBody>
              <AlertDialogFooter>
                <IAIButton ref={cancelRef} onClick={onClose}>
                  Cancel
                </IAIButton>
                <IAIButton colorScheme="error" onClick={handleDelete} ml={3}>
                  Delete
                </IAIButton>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialogOverlay>
        </AlertDialog>
      </>
    );
  }
);

DeleteImageModal.displayName = 'DeleteImageModal';

export default DeleteImageModal;
