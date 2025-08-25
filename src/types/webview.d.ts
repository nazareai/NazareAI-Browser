declare namespace JSX {
  interface IntrinsicElements {
    webview: React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
      src?: string
      nodeintegration?: boolean
      nodeintegrationinsubframes?: boolean
      webpreferences?: string
      allowpopups?: boolean
      plugins?: boolean
      preload?: string
      httpreferrer?: string
      useragent?: string
      disablewebsecurity?: boolean
      partition?: string
      allowtransparency?: boolean
      webgl?: boolean
      blinkfeatures?: string
      disableblinkfeatures?: string
      guestinstance?: string
      disableguestresize?: boolean
      autosize?: string | boolean
      minwidth?: string | number
      minheight?: string | number
      maxwidth?: string | number
      maxheight?: string | number
    }
  }
} 