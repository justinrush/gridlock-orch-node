export const cleanMongo = (doc: any) => {
  const cleanObject = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(cleanObject);
    } else if (obj && typeof obj === 'object' && obj !== null) {
      return Object.keys(obj).reduce((acc, key) => {
        if (!['id', '_id', '__v', 'createdAt', 'updatedAt'].includes(key)) {
          acc[key] = cleanObject(obj[key]);
        }
        return acc;
      }, {} as any);
    }
    return obj;
  };

  const plainObject = doc?.toObject ? doc.toObject() : doc;
  return cleanObject(plainObject);
};
