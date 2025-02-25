import {
  PayloadAction,
  createEntityAdapter,
  createSlice,
} from '@reduxjs/toolkit';
import { Image } from 'app/invokeai';
import { invocationComplete } from 'services/events/actions';

import { RootState } from 'app/store';
import {
  receivedResultImagesPage,
  IMAGES_PER_PAGE,
} from 'services/thunks/gallery';
import { isImageOutput } from 'services/types/guards';
import {
  buildImageUrls,
  extractTimestampFromImageName,
} from 'services/util/deserializeImageField';
import { deserializeImageResponse } from 'services/util/deserializeImageResponse';
import { imageReceived, thumbnailReceived } from 'services/thunks/image';

// use `createEntityAdapter` to create a slice for results images
// https://redux-toolkit.js.org/api/createEntityAdapter#overview

// the "Entity" is InvokeAI.ResultImage, while the "entities" are instances of that type
export const resultsAdapter = createEntityAdapter<Image>({
  // Provide a callback to get a stable, unique identifier for each entity. This defaults to
  // `(item) => item.id`, but for our result images, the `name` is the unique identifier.
  selectId: (image) => image.name,
  // Order all images by their time (in descending order)
  sortComparer: (a, b) => b.metadata.created - a.metadata.created,
});

// This type is intersected with the Entity type to create the shape of the state
type AdditionalResultsState = {
  // these are a bit misleading; they refer to sessions, not results, but we don't have a route
  // to list all images directly at this time...
  page: number; // current page we are on
  pages: number; // the total number of pages available
  isLoading: boolean; // whether we are loading more images or not, mostly a placeholder
  nextPage: number; // the next page to request
  shouldFetchImages: boolean; // whether we need to re-fetch images or not
};

export const initialResultsState =
  resultsAdapter.getInitialState<AdditionalResultsState>({
    // provide the additional initial state
    page: 0,
    pages: 0,
    isLoading: false,
    nextPage: 0,
    shouldFetchImages: false,
  });

export type ResultsState = typeof initialResultsState;

const resultsSlice = createSlice({
  name: 'results',
  initialState: initialResultsState,
  reducers: {
    // the adapter provides some helper reducers; see the docs for all of them
    // can use them as helper functions within a reducer, or use the function itself as a reducer

    // here we just use the function itself as the reducer. we'll call this on `invocation_complete`
    // to add a single result
    resultAdded: resultsAdapter.upsertOne,

    setShouldFetchImages: (state, action: PayloadAction<boolean>) => {
      state.shouldFetchImages = action.payload;
    },
  },
  extraReducers: (builder) => {
    // here we can respond to a fulfilled call of the `getNextResultsPage` thunk
    // because we pass in the fulfilled thunk action creator, everything is typed

    /**
     * Received Result Images Page - PENDING
     */
    builder.addCase(receivedResultImagesPage.pending, (state) => {
      state.isLoading = true;
    });

    /**
     * Received Result Images Page - FULFILLED
     */
    builder.addCase(receivedResultImagesPage.fulfilled, (state, action) => {
      const { items, page, pages } = action.payload;

      const resultImages = items.map((image) =>
        deserializeImageResponse(image)
      );

      // use the adapter reducer to append all the results to state
      resultsAdapter.addMany(state, resultImages);

      state.page = page;
      state.pages = pages;
      state.nextPage = items.length < IMAGES_PER_PAGE ? page : page + 1;
      state.isLoading = false;
    });

    /**
     * Invocation Complete
     */
    builder.addCase(invocationComplete, (state, action) => {
      const { data } = action.payload;
      const { result, node, graph_execution_state_id } = data;

      if (isImageOutput(result)) {
        const name = result.image.image_name;
        const type = result.image.image_type;
        // if we need to refetch, set URLs to placeholder for now
        const { url, thumbnail } = state.shouldFetchImages
          ? { url: '', thumbnail: '' }
          : buildImageUrls(type, name);

        const timestamp = extractTimestampFromImageName(name);

        const image: Image = {
          name,
          type,
          url,
          thumbnail,
          metadata: {
            created: timestamp,
            width: result.width, // TODO: add tese dimensions
            height: result.height,
            invokeai: {
              session_id: graph_execution_state_id,
              ...(node ? { node } : {}),
            },
          },
        };

        resultsAdapter.addOne(state, image);
      }
    });

    builder.addCase(imageReceived.fulfilled, (state, action) => {
      const { imagePath } = action.payload;
      const { imageName } = action.meta.arg;

      resultsAdapter.updateOne(state, {
        id: imageName,
        changes: {
          url: imagePath,
        },
      });
    });

    builder.addCase(thumbnailReceived.fulfilled, (state, action) => {
      const { thumbnailPath } = action.payload;
      const { imageName } = action.meta.arg;

      resultsAdapter.updateOne(state, {
        id: imageName,
        changes: {
          thumbnail: thumbnailPath,
        },
      });
    });
  },
});

// Create a set of memoized selectors based on the location of this entity state
// to be used as selectors in a `useAppSelector()` call
export const {
  selectAll: selectResultsAll,
  selectById: selectResultsById,
  selectEntities: selectResultsEntities,
  selectIds: selectResultsIds,
  selectTotal: selectResultsTotal,
} = resultsAdapter.getSelectors<RootState>((state) => state.results);

export const { resultAdded, setShouldFetchImages } = resultsSlice.actions;

export default resultsSlice.reducer;
