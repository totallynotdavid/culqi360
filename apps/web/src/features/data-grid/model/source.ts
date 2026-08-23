export type DataGridSource<T> = {
  rows: ReadonlyArray<T>;
  totalCount?: number;
};
