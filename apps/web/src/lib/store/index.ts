import { configureStore } from "@reduxjs/toolkit";
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import roomReducer from "./room-slice";

export const makeStore = () => {
  return configureStore({
    reducer: {
      room: roomReducer
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: {
          // Ignore actions or state paths if non-serializable objects occur
          ignoredActions: ["room/hydrateCache", "room/setRoomDetail", "room/upsertRoom"],
          ignoredPaths: ["room.roomsByCode"]
        }
      })
  });
};

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
