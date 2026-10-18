import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Rect, Stop, Text as SvgText } from 'react-native-svg';
import { colors, formatCompact, formatMoney } from '../theme';

// Vertical bars. data: [{ label, value, highlight? }]
export function BarChart({ data, width, height = 150 }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  const padTop = 18;
  const padBottom = 22;
  const chartH = height - padTop - padBottom;
  const slot = width / data.length;
  const barW = Math.min(26, slot * 0.6);
  const baseY = padTop + chartH;

  return (
    <Svg width={width} height={height}>
      <Line x1={0} x2={width} y1={baseY} y2={baseY} stroke={colors.border} strokeWidth={1} />
      {data.map((d, i) => {
        const h = d.value > 0 ? Math.max((d.value / max) * chartH, 3) : 0;
        const x = i * slot + (slot - barW) / 2;
        const y = baseY - h;
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={h} rx={5} fill={d.highlight ? colors.accent : colors.gold} />
            {d.value > 0 && (
              <SvgText x={x + barW / 2} y={y - 5} fontSize={9} fill={colors.muted} textAnchor="middle">
                {formatCompact(d.value)}
              </SvgText>
            )}
            <SvgText
              x={x + barW / 2}
              y={height - 6}
              fontSize={10}
              fontWeight={d.highlight ? 'bold' : 'normal'}
              fill={d.highlight ? colors.accent : colors.muted}
              textAnchor="middle"
            >
              {d.label}
            </SvgText>
          </G>
        );
      })}
    </Svg>
  );
}

// Trend line with soft area fill and a dashed average line. data: [{ label, value }]
export function LineChart({ data, width, height = 160, labelEvery = 5 }) {
  const padX = 10;
  const padTop = 16;
  const padBottom = 22;
  const w = width - padX * 2;
  const h = height - padTop - padBottom;
  const values = data.map((d) => d.value);
  const max = Math.max(...values, 1);
  const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((d, i) => [padX + i * step, padTop + h - (d.value / max) * h]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ');
  const last = pts[pts.length - 1] || [padX, padTop + h];
  const area = `${line} L${last[0]},${padTop + h} L${padX},${padTop + h} Z`;
  const avgY = padTop + h - (avg / max) * h;

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.gold} stopOpacity={0.45} />
          <Stop offset="1" stopColor={colors.gold} stopOpacity={0.02} />
        </LinearGradient>
      </Defs>
      <Line x1={0} x2={width} y1={padTop + h} y2={padTop + h} stroke={colors.border} />
      {pts.length > 0 && <Path d={area} fill="url(#trendFill)" />}
      {pts.length > 0 && <Path d={line} stroke={colors.goldDark} strokeWidth={2.5} fill="none" strokeLinejoin="round" />}
      {avg > 0 && (
        <>
          <Line x1={padX} x2={width - padX} y1={avgY} y2={avgY} stroke={colors.accent} strokeWidth={1} strokeDasharray="4 4" />
          <SvgText x={width - padX} y={avgY - 4} fontSize={9} fill={colors.accent} textAnchor="end">
            avg {formatCompact(avg)}
          </SvgText>
        </>
      )}
      {pts.length > 0 && <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.accent} stroke="#fff" strokeWidth={2} />}
      {data.map((d, i) =>
        i % labelEvery === 0 || i === data.length - 1 ? (
          <SvgText key={i} x={pts[i][0]} y={height - 6} fontSize={9} fill={colors.muted} textAnchor="middle">
            {d.label}
          </SvgText>
        ) : null
      )}
    </Svg>
  );
}

// Donut with legend. data: [{ key, label, value, color }]
export function DonutChart({ data, size = 140, stroke = 22 }) {
  const total = data.reduce((t, d) => t + d.value, 0);
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  const c = size / 2;
  let offset = 0;

  return (
    <View style={styles.donutWrap}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G rotation={-90} origin={`${c}, ${c}`}>
            <Circle cx={c} cy={c} r={r} stroke={colors.goldSoft} strokeWidth={stroke} fill="none" />
            {total > 0 &&
              data.map((d) => {
                const len = (d.value / total) * C;
                const seg = (
                  <Circle
                    key={d.key}
                    cx={c}
                    cy={c}
                    r={r}
                    stroke={d.color}
                    strokeWidth={stroke}
                    fill="none"
                    strokeDasharray={`${len} ${C - len}`}
                    strokeDashoffset={-offset}
                  />
                );
                offset += len;
                return seg;
              })}
          </G>
        </Svg>
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          <Text style={styles.centerLabel}>Total</Text>
          <Text style={styles.centerValue} numberOfLines={1} adjustsFontSizeToFit>
            {formatMoney(total)}
          </Text>
        </View>
      </View>

      <View style={styles.legend}>
        {data.map((d) => (
          <View key={d.key} style={styles.legendRow}>
            <View style={[styles.dot, { backgroundColor: d.color }]} />
            <Text style={styles.legendLabel} numberOfLines={1}>
              {d.label}
            </Text>
            <Text style={styles.legendPct}>{total ? Math.round((d.value / total) * 100) : 0}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutWrap: { alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 26 },
  centerLabel: { fontSize: 11, color: colors.muted },
  centerValue: { fontSize: 14, fontWeight: '800', color: colors.text },
  legend: { alignSelf: 'stretch', marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendLabel: { flex: 1, fontSize: 13, color: colors.text },
  legendPct: { fontSize: 13, fontWeight: '700', color: colors.text },
});
