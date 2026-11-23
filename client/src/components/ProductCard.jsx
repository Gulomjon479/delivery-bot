export const ProductCard = ({ product, onAdd, onDelete }) => (
  <div className="bg-gray-800 rounded-xl overflow-hidden border border-gray-700 card-hover">
    {product.photo_url ? (
      <img
        src={product.photo_url}
        alt={product.name}
        className="w-full h-36 object-cover"
      />
    ) : (
      <div className="w-full h-36 bg-gray-700 flex items-center justify-center text-4xl">🍔</div>
    )}
    <div className="p-3">
      <h3 className="font-semibold text-white truncate">{product.name}</h3>
      {product.weight && <p className="text-gray-400 text-xs mt-0.5">{product.weight}</p>}
      <div className="flex items-center justify-between mt-2">
        <p className="text-orange-400 font-bold">{product.price?.toLocaleString()} UZS</p>
        {onAdd && (
          <button
            onClick={() => onAdd(product)}
            className="bg-orange-500 hover:bg-orange-600 text-white rounded-lg px-3 py-1 text-sm font-medium transition-colors"
          >
            + Qo'shish
          </button>
        )}
        {onDelete && (
          <button
            onClick={() => onDelete(product.id)}
            className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-3 py-1 text-sm font-medium transition-colors"
          >
            O'chirish
          </button>
        )}
      </div>
    </div>
  </div>
);

export default ProductCard;
