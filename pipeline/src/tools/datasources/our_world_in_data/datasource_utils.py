"""Utility classes for Our World in Data data sources."""

from dataclasses import dataclass
from pathlib import Path
from typing import Iterator, Optional, Union
import yaml


@dataclass
class OurWorldInDataSource:
    """Base class for Our World in Data data sources."""

    name: str
    type: str
    citation: str
    citation_url: str

    @classmethod
    def from_dict(cls, data: dict) -> Union['CatalogDataSource', 'ChartDataSource']:
        """Create appropriate data source instance from dictionary.

        Args:
            data: Dictionary containing data source configuration

        Returns:
            CatalogDataSource or ChartDataSource instance based on type
        """
        source_type = data.get('type')
        if source_type == 'catalog':
            return CatalogDataSource.from_dict(data)
        elif source_type == 'chart':
            return ChartDataSource.from_dict(data)
        else:
            raise ValueError(f"Unknown data source type: {source_type}")

    @staticmethod
    def load_all(yaml_path: Optional[Path] = None) -> Iterator[Union['CatalogDataSource', 'ChartDataSource']]:
        """Load all data sources from YAML file.

        Args:
            yaml_path: Path to YAML file. If None, uses default path.

        Yields:
            Data source instances (CatalogDataSource or ChartDataSource)
        """
        if yaml_path is None:
            # Default path relative to project root
            yaml_path = Path(__file__).parent.parent.parent.parent / "config" / "datasource_metadata" / "world_in_data.yaml"

        with open(yaml_path, 'r') as f:
            config = yaml.safe_load(f)

        for table_data in config.get('tables', []):
            yield OurWorldInDataSource.from_dict(table_data)

    @staticmethod
    def load_catalogs(yaml_path: Optional[Path] = None) -> Iterator['CatalogDataSource']:
        """Load only catalog data sources from YAML file.

        Args:
            yaml_path: Path to YAML file. If None, uses default path.

        Yields:
            CatalogDataSource instances
        """
        for source in OurWorldInDataSource.load_all(yaml_path):
            if isinstance(source, CatalogDataSource):
                yield source

    @staticmethod
    def load_charts(yaml_path: Optional[Path] = None) -> Iterator['ChartDataSource']:
        """Load only chart data sources from YAML file.

        Args:
            yaml_path: Path to YAML file. If None, uses default path.

        Yields:
            ChartDataSource instances
        """
        for source in OurWorldInDataSource.load_all(yaml_path):
            if isinstance(source, ChartDataSource):
                yield source


@dataclass
class CatalogDataSource(OurWorldInDataSource):
    """Data source for catalog-type entries."""

    channel: str
    channel_dataset: str
    version: str
    dataset: str
    license: str
    base_url: str
    unit: Optional[str] = None

    @classmethod
    def from_dict(cls, data: dict) -> 'CatalogDataSource':
        """Create CatalogDataSource instance from dictionary.

        Args:
            data: Dictionary containing catalog configuration

        Returns:
            CatalogDataSource instance
        """
        return cls(
            name=data['name'],
            type=data['type'],
            citation=data['citation'],
            citation_url=data['citation_url'],
            channel=data['channel'],
            channel_dataset=data['channel_dataset'],
            version=data['version'],
            dataset=data['dataset'],
            license=data['license'],
            base_url=data['base_url'],
            unit=data.get('unit'),
        )

    def get_catalog_url(self) -> str:
        """Construct the full catalog URL.

        Returns:
            Full URL to the catalog dataset
        """
        return f"{self.base_url}{self.channel}/{self.channel_dataset}/{self.version}/{self.dataset}/{self.name}"


@dataclass
class ChartDataSource(OurWorldInDataSource):
    """Data source for chart-type entries."""

    @classmethod
    def from_dict(cls, data: dict) -> 'ChartDataSource':
        """Create ChartDataSource instance from dictionary.

        Args:
            data: Dictionary containing chart configuration

        Returns:
            ChartDataSource instance
        """
        return cls(
            name=data['name'],
            type=data['type'],
            citation=data['citation'],
            citation_url=data['citation_url'],
        )

    def get_chart_url(self) -> str:
        """Get the chart URL.

        Returns:
            URL to the chart
        """
        return self.citation_url
