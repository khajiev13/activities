import { Map } from 'maplibre-gl';
import ReactDOM from 'react-dom';
import { Button } from '@/components/ui/button';

export class MapControlPanel {
  private _map: Map | undefined;
  private _container: HTMLDivElement;

  constructor() {
    this._container = document.createElement('div');
  }

  public onAdd(map: Map): HTMLElement {
    this._map = map;
    this._container.className = 'maplibregl-ctrl map-control-panel';

    // Create buttons for Activities, Teams, and Organizations
    const buttons = (
      <div className="flex flex-col gap-3">
        {this._createButton('Organizations', () => {
          console.log('Organizations button clicked');
          // Render organizations on the map here
        })}
        {this._createButton('Activities', () => {
          console.log('Activities button clicked');
          // Render activities on the map here
        })}
        {this._createButton('Teams', () => {
          console.log('Teams button clicked');
          // Render teams on the map here
        })}

        {this._createButton('People', () => {
          console.log('People button clicked');
          // Render teams on the map here
        })}
      </div>
    );

    ReactDOM.render(buttons, this._container);

    return this._container;
  }

  public onRemove(): void {
    if (this._container.parentNode) {
      this._container.parentNode.removeChild(this._container);
      if (this._map) {
        this._map = undefined;
      }
    }
  }

  private _createButton(text: string, callback: () => void): JSX.Element {
    return (
      <Button
        className="bg-background text-black dark:text-white "
        onClick={callback}
      >
        {text}
      </Button>
    );
  }
}
