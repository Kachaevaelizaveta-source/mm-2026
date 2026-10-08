const { createApp } = Vue;

createApp({
  data() {
    return {
      runners: [],
      currentPage: 1,
      pageSize: 100,
      loading: true,
      error: '',
      tooltip: null
    };
  },
  computed: {
    pageCount() {
      return Math.max(1, Math.ceil(this.runners.length / this.pageSize));
    },
    visibleRunners() {
      const start = (this.currentPage - 1) * this.pageSize;
      return this.runners.slice(start, start + this.pageSize);
    },
    firstRecord() {
      return this.runners.length ? (this.currentPage - 1) * this.pageSize + 1 : 0;
    },
    lastRecord() {
      return Math.min(this.currentPage * this.pageSize, this.runners.length);
    },
    formattedTotal() {
      return d3.format(',')(this.runners.length).replaceAll(',', ' ');
    },
    finishers() {
      return this.runners
        .map(runner => ({ ...runner, finishSeconds: this.toSeconds(runner.finishTime) }))
        .filter(runner => Number.isFinite(runner.finishSeconds));
    },
    genderTotals() {
      return { M: this.runners.filter(runner => runner.gender === 'M').length, F: this.runners.filter(runner => runner.gender === 'F').length };
    },
    genderPercent() {
      return {
        M: Math.round((this.genderTotals.M / this.runners.length) * 100),
        F: Math.round((this.genderTotals.F / this.runners.length) * 100)
      };
    },
    ageRange() {
      const ages = this.runners.map(runner => Number(runner.age)).filter(Number.isFinite);
      return { min: d3.min(ages) || 0, max: d3.max(ages) || 0 };
    },
    topCountries() {
      const counts = d3.rollups(this.runners.filter(runner => runner.country && runner.country !== '-'), values => values.length, runner => runner.country)
        .sort((a, b) => d3.descending(a[1], b[1]));
      return counts.slice(0, 5).map(([name, count]) => ({ name, count, percent: Math.round((count / this.runners.length) * 100) }));
    },
    otherCountryCount() {
      return Math.max(0, d3.rollups(this.runners.filter(runner => runner.country && runner.country !== '-'), values => values.length, runner => runner.country).length - 5);
    },
    otherCountryLabel() {
      const count = this.runners.length - this.topCountries.reduce((sum, country) => sum + country.count, 0);
      return `${count ? this.formatNumber(count) : 0} участников из других стран`;
    },
    topAthletes() {
      return {
        M: this.finishers.filter(runner => runner.gender === 'M').sort((a, b) => a.finishSeconds - b.finishSeconds).slice(0, 3),
        F: this.finishers.filter(runner => runner.gender === 'F').sort((a, b) => a.finishSeconds - b.finishSeconds).slice(0, 3)
      };
    }
  },
  methods: {
    formatNumber(value) {
      return d3.format(',')(value).replaceAll(',', ' ');
    },
    toSeconds(value) {
      if (!value || !/^\d{1,2}:\d{2}:\d{2}$/.test(value)) return NaN;
      const [hours, minutes, seconds] = value.split(':').map(Number);
      return hours * 3600 + minutes * 60 + seconds;
    },
    goToPage(page) {
      this.currentPage = Math.min(Math.max(page, 1), this.pageCount);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    drawCharts() {
      this.drawAgeChart();
      this.drawFinishChart();
    },
    drawAgeChart() {
      const ageChart = this.$refs.ageChart || document.querySelector('.age-chart');
      if (!ageChart) return;
      const svg = d3.select(ageChart);
      svg.selectAll('*').remove();
      const width = 360;
      const height = 330;
      const margin = { top: 8, right: 36, bottom: 18, left: 36 };
      svg.attr('viewBox', `0 0 ${width} ${height}`);
      const ages = d3.range(this.ageRange.min, this.ageRange.max + 1);
      const counts = d3.rollup(this.runners, values => values.length, runner => +runner.age, runner => runner.gender);
      const data = ages.map(age => ({
        age,
        M: counts.get(age)?.get('M') || 0,
        F: counts.get(age)?.get('F') || 0
      }));
      const x = d3.scaleLinear().domain([0, d3.max(data, d => Math.max(d.M, d.F)) || 1]).range([0, 132]);
      const y = d3.scaleBand().domain(ages).range([margin.top, height - margin.bottom]).paddingInner(.18);
      const group = svg.append('g').attr('transform', `translate(${width / 2},0)`);
      group.append('g').selectAll('rect').data(data).join('rect')
        .attr('x', d => -x(d.M)).attr('y', d => y(d.age)).attr('width', d => x(d.M)).attr('height', y.bandwidth()).attr('fill', '#49a8e8');
      group.append('g').selectAll('rect').data(data).join('rect')
        .attr('x', 0).attr('y', d => y(d.age)).attr('width', d => x(d.F)).attr('height', y.bandwidth()).attr('fill', '#fa7a94');
      group.append('line').attr('y1', margin.top).attr('y2', height - margin.bottom).attr('stroke', '#d9dde3');
      const tickAges = ages.filter(age => age === ages[0] || age === ages[ages.length - 1] || age % 5 === 0);
      svg.append('g').selectAll('text').data(tickAges).join('text')
        .attr('x', width / 2 + 88).attr('y', age => y(age) + y.bandwidth() / 2 + 4).attr('fill', '#8c96a3').attr('font-size', 12).text(age => age);
      svg.append('g').selectAll('line').data(tickAges).join('line')
        .attr('x1', 0).attr('x2', width).attr('y1', age => y(age) + y.bandwidth() / 2).attr('y2', age => y(age) + y.bandwidth() / 2).attr('stroke', '#e4e8ec').attr('stroke-width', 1);
      group.raise();
    },
    drawFinishChart() {
      const finishChart = this.$refs.finishChart || document.querySelector('.finish-chart');
      if (!finishChart) return;
      const svg = d3.select(finishChart);
      svg.selectAll('*').remove();
      const width = 1180;
      const height = 390;
      const margin = { top: 12, right: 18, bottom: 36, left: 0 };
      svg.attr('viewBox', `0 0 ${width} ${height}`);
      const finishers = this.finishers.slice().sort((a, b) => {
        const minute = Math.floor(a.finishSeconds / 60) - Math.floor(b.finishSeconds / 60);
        return minute || (a.gender === b.gender ? a.age - b.age : a.gender === 'M' ? -1 : 1) || a.finishSeconds - b.finishSeconds;
      });
      const min = d3.min(finishers, d => d.finishSeconds) || 0;
      const max = d3.max(finishers, d => d.finishSeconds) || 1;
      const x = d3.scaleLinear().domain([min, max]).range([0, width - margin.right]);
      const y = d3.scaleLinear().domain([0, finishers.length - 1]).range([margin.top, height - margin.bottom]);
      const color = d3.scaleOrdinal().domain(['M', 'F']).range(['#35a2ec', '#f5839b']);
      const tooltip = d3.select(finishChart.parentNode).selectAll('.chart-tooltip').data([null]).join('div').attr('class', 'chart-tooltip');
      svg.append('g').selectAll('line').data(finishers).join('line')
        .attr('x1', d => x(d.finishSeconds)).attr('x2', d => x(d.finishSeconds) + 2.6)
        .attr('y1', (_, index) => y(index)).attr('y2', (_, index) => y(index))
        .attr('stroke', d => color(d.gender)).attr('stroke-width', 2.1).attr('stroke-linecap', 'round')
        .on('mouseenter', (event, runner) => {
          tooltip.style('opacity', 1).html(`<strong>${runner.name}</strong><span>${runner.finishTime} · ${runner.age} лет · ${runner.country}</span>`);
        })
        .on('mousemove', event => tooltip.style('left', `${event.offsetX + 14}px`).style('top', `${event.offsetY - 16}px`))
        .on('mouseleave', () => tooltip.style('opacity', 0));
      const ticks = d3.timeMinute.every(30) ? d3.range(Math.ceil(min / 1800) * 1800, max + 1, 1800) : [];
      svg.append('g').attr('transform', `translate(0,${height - margin.bottom + 12})`).selectAll('text').data(ticks).join('text')
        .attr('x', seconds => x(seconds)).attr('text-anchor', 'middle').attr('fill', '#626d79').attr('font-size', 12).text(seconds => this.formatTime(seconds));
      svg.append('line').attr('x1', 0).attr('x2', width - margin.right).attr('y1', height - margin.bottom).attr('y2', height - margin.bottom).attr('stroke', '#7f8995');
    },
    formatTime(seconds) {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    }
  },
  async mounted() {
    try {
      const response = await fetch('results.json');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.runners = await response.json();
      this.loading = false;
      await this.$nextTick();
      this.drawCharts();
    } catch (error) {
      this.error = `Не удалось загрузить results.json: ${error.message}`;
      this.loading = false;
    }
  }
}).mount('#app');
