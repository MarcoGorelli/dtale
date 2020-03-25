import numpy as np
import pandas as pd
import string
import random

import dtale.global_state as global_state


class ColumnBuilder(object):

    def __init__(self, data_id, column_type, name, cfg):
        self.data_id = data_id
        if column_type == 'numeric':
            self.builder = NumericColumnBuilder(name, cfg)
        elif column_type == 'datetime':
            self.builder = DatetimeColumnBuilder(name, cfg)
        elif column_type == 'bins':
            self.builder = BinsColumnBuilder(name, cfg)
        elif column_type == 'random':
            self.builder = RandomColumnBuilder(name, cfg)
        else:
            raise NotImplementedError('{} column builder not implemented yet!'.format(column_type))

    def build_column(self):
        data = global_state.get_data(self.data_id)
        return self.builder.build_column(data)

    def build_code(self):
        return self.builder.build_code()


class NumericColumnBuilder(object):

    def __init__(self, name, cfg):
        self.name = name
        self.cfg = cfg

    def build_column(self, data):
        left, right, operation = (self.cfg.get(p) for p in ['left', 'right', 'operation'])
        left = data[left['col']] if 'col' in left else float(left['val'])
        right = data[right['col']] if 'col' in right else float(right['val'])
        if operation == 'sum':
            return left + right
        if operation == 'difference':
            return left - right
        if operation == 'multiply':
            return left * right
        if operation == 'divide':
            return left / right
        return np.nan

    def build_code(self):
        left, right, operation = (self.cfg.get(p) for p in ['left', 'right', 'operation'])
        operations = dict(sum='+', difference='-', multiply='*', divide='/')
        return "df.loc[:, '{name}'] = {left} {operation} {right}".format(
            name=self.name,
            operation=operations.get(operation),
            left="df['{}']".format(left['col']) if 'col' in left else left['val'],
            right="df['{}']".format(right['col']) if 'col' in right else right['val']
        )


FREQ_MAPPING = dict(month='M', quarter='Q', year='Y')


class DatetimeColumnBuilder(object):

    def __init__(self, name, cfg):
        self.name = name
        self.cfg = cfg

    def build_column(self, data):
        col = self.cfg['col']
        if 'property' in self.cfg:
            return getattr(data[col].dt, self.cfg['property'])
        conversion_key = self.cfg['conversion']
        [freq, how] = conversion_key.split('_')
        freq = FREQ_MAPPING[freq]
        conversion_data = data[[col]].set_index(col).index.to_period(freq).to_timestamp(how=how).normalize()
        return pd.Series(conversion_data, index=data.index, name=self.name)

    def build_code(self):
        if 'property' in self.cfg:
            return "df.loc[:, '{name}'] = df['{col}'].dt.{property}".format(name=self.name, **self.cfg)
        conversion_key = self.cfg['conversion']
        [freq, how] = conversion_key.split('_')
        freq = FREQ_MAPPING[freq]
        return (
            "{name}_data = data[['{col}']].set_index('{col}').index.to_period('{freq}')'"
            ".to_timestamp(how='{how}').normalize()\n"
            "df.loc[:, '{name}'] = pd.Series({name}_data, index=df.index, name='{name}')"
        ).format(name=self.name, col=self.cfg['col'], freq=freq, how=how)


class BinsColumnBuilder(object):

    def __init__(self, name, cfg):
        self.name = name
        self.cfg = cfg

    def build_column(self, data):
        col, operation, bins, labels = (self.cfg.get(p) for p in ['col', 'operation', 'bins', 'labels'])
        bins = int(bins)
        if operation == 'cut':
            bin_data = pd.cut(data[col], bins=bins)
        else:
            bin_data = pd.qcut(data[col], q=bins)
        if labels:
            cats = {idx: str(cat) for idx, cat in enumerate(labels.split(','))}
        else:
            cats = {idx: str(cat) for idx, cat in enumerate(bin_data.cat.categories)}
        return pd.Series(bin_data.cat.codes.map(cats), index=data.index, name=self.name)

    def build_code(self):
        col, operation, bins, labels = (self.cfg.get(p) for p in ['col', 'operation', 'bins', 'labels'])
        bins_code = []
        if operation == 'cut':
            bins_code.append("{name}_data = pd.cut(df['{col}'], bins={bins})".format(
                name=self.name, col=col, bins=bins
            ))
        else:
            bins_code.append("{name}_data = pd.qcut(df['{col}'], bins={bins})".format(
                name=self.name, col=col, bins=bins
            ))
        if labels:
            labels_str = ', '.join(['{}: {}'.format(idx, cat) for idx, cat in enumerate(labels.split(','))])
            labels_str = '{' + labels_str + '}'
            bins_code.append('{name}_cats = {labels}'.format(name=self.name, labels=labels_str))
        else:
            bins_code.append(
                '{name}_cats = {idx: str(cat) for idx, cat in enumerate({name}_data.cat.categories)}'
            )
        s_str = "df.loc[:, '{name}'] = pd.Series({name}_data.cat.codes.map({name}_cats), index=df.index, name='{name}')"
        bins_code.append(s_str.format(name=self.name))
        return '\n'.join(bins_code)


def id_generator(size=10, chars=string.ascii_uppercase + string.digits):
    return ''.join(random.choice(chars) for _ in range(int(size)))


class RandomColumnBuilder(object):

    def __init__(self, name, cfg):
        self.name = name
        self.cfg = cfg

    def build_column(self, data):
        rand_type = self.cfg['type']
        if 'string' == rand_type:
            kwargs = dict(size=self.cfg.get('length', 10))
            if self.cfg.get('chars'):
                kwargs['chars'] = self.cfg['chars']
            return pd.Series(
                [id_generator(**kwargs) for _ in range(len(data))], index=data.index, name=self.name
            )
        if 'int' == rand_type:
            low = self.cfg.get('low', 0)
            high = self.cfg.get('high', 100)
            return pd.Series(
                np.random.randint(low, high=high, size=len(data)), index=data.index, name=self.name
            )
        # floats
        low = self.cfg.get('low', 0)
        high = self.cfg.get('high', 1)
        floats = np.random.rand(len(data))
        if low != 0 or high != 1:
            ints = np.random.randint(low, high=high - 1, size=len(data))
            floats = floats + ints
        return pd.Series(floats, index=data.index, name=self.name)

    def build_code(self):
        rand_type = self.cfg['type']
        if 'string' == rand_type:
            kwargs = []
            if self.cfg.get('length') != 10:
                kwargs.append('size={size}'.format(size=self.cfg.get('length')))
            if self.cfg.get('chars'):
                kwargs.append("chars='{chars}'".format(chars=self.cfg.get('chars')))
            kwargs = ', '.join(kwargs)
            return (
                'import number\nimport random\n\n'
                'def id_generator(size=1500, chars=string.ascii_uppercase + string.digits):\n'
                "\treturn ''.join(random.choice(chars) for _ in range(size))\n\n"
                "df.loc[:, '{name}'] = pd.Series([id_generator({kwargs}) for _ in range(len(df)], index=df.index)"
            ).format(kwargs=kwargs, name=self.name)
            return "df.loc[:, '{name}'] = df['{col}'].dt.{property}".format(name=self.name, **self.cfg)

        if 'int' == rand_type:
            low = self.cfg.get('low', 0)
            high = self.cfg.get('high', 100)
            return (
                'import numpy as np\n\n'
                "df.loc[:, '{name}'] = pd.Series(np.random.randint({low}, high={high}, size=len(df)), index=df.index)"
            ).format(name=self.name, low=low, high=high)

        low = self.cfg.get('low', 0)
        high = self.cfg.get('high', 1)
        if low != 0 or high != 1:
            return (
                'import numpy as np\n\n'
                'floats = np.random.rand(len(df))\n'
                'ints = np.random.randint({low}, high={high}, size=len(df))\n'
                "df.loc[:, '{name}'] = pd.Series(floats + ints, index=dfr.index)"
            ).format(name=self.name, low=low, high=high - 1)
        return (
            'import numpy as np\n\n'
            "df.loc[:, '{name}'] = pd.Series(np.random.rand(len(df)), index=df.index)"
        ).format(name=self.name)
