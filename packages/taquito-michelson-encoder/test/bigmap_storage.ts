import { storage } from '../data/bigmap_storage';
import { Schema } from '../src/schema/storage';

describe('Schema test', () => {
  it('Should parse storage schema properly', () => {
    const schema = new Schema(storage);
    expect(schema.Encode()).toEqual({
      mgr1: {
        addr: 'address',
        key: 'key_hash',
      },
      mgr2: {
        addr: 'address',
        key: 'key_hash',
      },
    });
  });
});
