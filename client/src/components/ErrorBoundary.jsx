import React from 'react'

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
          <div className="text-5xl">⚠️</div>
          <h2 className="text-lg font-bold text-orange-400">Kutilmagan xatolik yuz berdi</h2>
          <p className="text-xs text-gray-400 max-w-sm">
            Ilova ishlashida xatolik yuz berdi. Iltimos, ilovani qayta yuklang yoki qayta urinib ko'ring.
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleReload}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              🔄 Qayta yuklash
            </button>
            <button
              onClick={this.handleReset}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold text-xs rounded-xl transition-all"
            >
              Qayta urinish
            </button>
          </div>
          {this.state.error?.message && (
            <pre className="text-[10px] text-gray-500 bg-gray-900 p-2 rounded-lg max-w-xs overflow-x-auto text-left">
              {this.state.error.message}
            </pre>
          )}
        </div>
      )
    }

    return this.props.children
  }
}
